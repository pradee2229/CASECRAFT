from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageOps
import pytesseract
import io
import re
import sqlite3
DATABASE = "patients.db"


def init_db():
    conn = sqlite3.connect(DATABASE)

    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            age TEXT,
            gender TEXT,
            phone TEXT,
            complaint TEXT,
            symptoms TEXT,
            duration TEXT,
            history TEXT,
            medications TEXT,
            allergies TEXT,
            report_text TEXT,
            test TEXT,
            result TEXT,
            reference_range TEXT,
            unit TEXT,
            alert TEXT,
            priority TEXT
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS test_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER,
            test TEXT,
            result TEXT,
            reference_range TEXT,
            unit TEXT,
            status TEXT,
            alert TEXT,
            priority TEXT,
            FOREIGN KEY (patient_id) REFERENCES patients(id)
        )
    """)

    conn.commit()
    conn.close()


init_db()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pytesseract.pytesseract.tesseract_cmd = (
    r"C:\Program Files\Tesseract-OCR\tesseract.exe"
)


@app.get("/")
def home():
    return {"message": "MedHistory AI Backend is running"}


@app.post("/upload-report")
async def upload_report(file: UploadFile = File(...)):

    contents = await file.read()

    try:
        image = Image.open(io.BytesIO(contents))

        # Improve image quality for OCR
        image = image.convert("L")
        image = ImageOps.autocontrast(image)

        # Increase image size for better text recognition
        image = image.resize(
           (image.width * 2, image.height * 2)
       )

        text = pytesseract.image_to_string(
        image,
        config="--psm 6"
        )

        return {
            "filename": file.filename,
            "text": text
        }

    except Exception as e:
        return {
            "error": str(e)
        }
@app.post("/analyze-report")
async def analyze_report(data: dict):

    text = data.get("text", "")

    # -------------------------
    # PATIENT NAME
    # -------------------------
    name_match = re.search(
        r"Name\s*[:\-]?\s*(.*?)(?=\s+(?:Visit|visit|Client|client|Age/Gender|collected|Collected)\b)",
        text,
        re.IGNORECASE | re.DOTALL
    )

    name = name_match.group(1).strip() if name_match else "Not detected"


    # -------------------------
    # AGE + GENDER
    # -------------------------
    age_gender_match = re.search(
        r"Age/Gender\s*[:\-]?\s*(\d+).*?/\s*(Male|Female|Other)",
        text,
        re.IGNORECASE | re.DOTALL
    )

    if age_gender_match:
        age = age_gender_match.group(1)
        gender = age_gender_match.group(2).capitalize()
    else:
        age = "Not detected"
        gender = "Not detected"

    # -------------------------
    # FIND MEDICAL TEST RESULTS
    # -------------------------
    results = []

    # Clean OCR text
    clean_text = re.sub(r"[ \t]+", " ", text)
    clean_text = re.sub(r"\n{2,}", "\n", clean_text)

    # Common laboratory result format:
    # Test Name + Result + H/L + Reference Range + Unit
    pattern = re.compile(
    r"^([A-Za-z][A-Za-z0-9\s\-\(\)\/%+]{1,60}?)"
    r"\s+"
    r"([<>]?\d+(?:\.\d+)?)"
    r"\s*(H|L|High|Low)?"
    r"\s+"
    r"(\d+(?:\.\d+)?)"
    r"\s*-\s*"
    r"(\d+(?:\.\d+)?)"
    r"\s*"
    r"([A-Za-zµμ0-9/%\^\.\*]+(?:/[A-Za-z0-9]+)?)?"
    r"(?:\s+(?:CMIA|ECLIA|CLIA|ELISA|HPLC|PCR))?"
    r"\s*$",
    re.IGNORECASE
)

    ignored_words = [
        "patient",
        "specimen",
        "client",
        "doctor",
        "visit",
        "collected",
        "received",
        "reported",
        "mobile",
        "address",
        "name",
        "age",
        "gender"
    ]

    for line in clean_text.splitlines():

        line = line.strip()

        if not line:
            continue

        match = pattern.match(line)

        if not match:
            continue

        test_name = match.group(1).strip()
        value = match.group(2)
        flag = match.group(3)
        lower = match.group(4)
        upper = match.group(5)
        unit = match.group(6) or ""
        # Do not treat laboratory testing methods as measurement units
        if unit.upper() in ["CMIA", "ECLIA", "CLIA", "ELISA", "HPLC", "PCR"]:
            unit = ""
        # Ignore patient-information lines
        if any(word in test_name.lower() for word in ignored_words):
            continue

        try:
            raw_value = value.replace("<", "").replace(">", "").strip()

            # Remove comma used as a thousands separator
            raw_value = raw_value.replace(",", "")

            numeric_value = float(raw_value)

            lower_value = float(lower)
            upper_value = float(upper)

            # Fix OCR cases such as 1.201 being read instead of 1201
            if "." in raw_value:
                parts = raw_value.split(".")

                if len(parts) == 2 and len(parts[1]) == 3:
                    corrected_value = float(parts[0] + parts[1])

                    if numeric_value < lower_value and corrected_value >= lower_value:
                        numeric_value = corrected_value
                        value = str(int(corrected_value))

            # Check whether the laboratory report explicitly
            # marks the result as critical
            critical_flags = [
                "critical",
                "very high",
                "very low"
            ]

            flag_text = flag.lower() if flag else ""

            if any(item in flag_text for item in critical_flags):
                priority = "CRITICAL"

                if numeric_value < lower_value:
                    status = "LOW"
                    alert = f"{test_name} is critically below the reference range."
                elif numeric_value > upper_value:
                    status = "HIGH"
                    alert = f"{test_name} is critically above the reference range."
                else:
                    status = "NORMAL"
                    alert = f"{test_name} is marked critical by the report."

            elif numeric_value < lower_value:
                status = "LOW"
                alert = f"{test_name} is below the reference range."
                priority = "ATTENTION REQUIRED"

            elif numeric_value > upper_value:
                status = "HIGH"
                alert = f"{test_name} is above the reference range."
                priority = "ATTENTION REQUIRED"

            else:
                status = "NORMAL"
                alert = f"{test_name} is within the reference range."
                priority = "NORMAL"

        except ValueError:
            status = "UNKNOWN"
            alert = f"Unable to evaluate {test_name}."
            priority = "ATTENTION REQUIRED"

        results.append({
            "test": test_name,
            "result": value,
            "unit": unit,
            "reference_range": f"{lower} - {upper}",
            "status": status,
            "alert": alert,
            "priority": priority
        })

    # -------------------------
    # IF NO TEST RESULT FOUND
    # -------------------------
    if not results:
        results.append({
            "test": "Not detected",
            "result": "Not detected",
            "unit": "",
            "reference_range": "",
            "status": "UNKNOWN",
            "alert": "No structured laboratory result detected.",
            "priority": "NORMAL"
        })

    # -------------------------
    # RETURN STRUCTURED DATA
    # -------------------------
    return {
        "patient_name": name,
        "age": age,
        "gender": gender,
        "results": results
    }
   
@app.post("/save-patient")
async def save_patient(data: dict):

    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()

    # Save main patient information
    cursor.execute("""
        INSERT INTO patients (
            name,
            age,
            gender,
            phone,
            complaint,
            symptoms,
            duration,
            history,
            medications,
            allergies,
            report_text,
            test,
            result,
            reference_range,
            unit,
            alert,
            priority
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        data.get("name", ""),
        data.get("age", ""),
        data.get("gender", ""),
        data.get("phone", ""),
        data.get("complaint", ""),
        data.get("symptoms", ""),
        data.get("duration", ""),
        data.get("history", ""),
        data.get("medications", ""),
        data.get("allergies", ""),
        data.get("report_text", ""),
        data.get("test", ""),
        data.get("result", ""),
        data.get("reference_range", ""),
        data.get("unit", ""),
        data.get("alert", ""),
        data.get("priority", "NORMAL")
    ))

    patient_id = cursor.lastrowid

    # Save multiple laboratory results
    results = data.get("results", [])

    for result in results:

        cursor.execute("""
            INSERT INTO test_results (
                patient_id,
                test,
                result,
                reference_range,
                unit,
                status,
                alert,
                priority
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            patient_id,
            result.get("test", ""),
            result.get("result", ""),
            result.get("reference_range", ""),
            result.get("unit", ""),
            result.get("status", ""),
            result.get("alert", ""),
            result.get("priority", "NORMAL")
        ))

    conn.commit()
    conn.close()

    return {
        "message": "Patient summary saved successfully",
        "patient_id": patient_id,
        "results_saved": len(results)
    }
@app.get("/patients")
async def get_patients():

    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            id,
            name,
            age,
            gender,
            test,
            result,
            unit,
            priority
        FROM patients
        ORDER BY id DESC
    """)

    patients = []

    for row in cursor.fetchall():

        patient = dict(row)

        cursor.execute("""
            SELECT
                id,
                test,
                result,
                reference_range,
                unit,
                status,
                alert,
                priority
            FROM test_results
            WHERE patient_id = ?
            ORDER BY id ASC
        """, (patient["id"],))

        patient["test_results"] = [
            dict(result)
            for result in cursor.fetchall()
        ]

        patients.append(patient)

    conn.close()

    return patients
@app.get("/patients/{patient_id}")
async def get_patient(patient_id: int):

    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Get main patient information
    cursor.execute(
        "SELECT * FROM patients WHERE id = ?",
        (patient_id,)
    )

    patient = cursor.fetchone()

    if not patient:
        conn.close()
        return {"error": "Patient not found"}

    patient_data = dict(patient)

    # Get all laboratory results for this patient
    cursor.execute("""
        SELECT
            id,
            test,
            result,
            reference_range,
            unit,
            status,
            alert,
            priority
        FROM test_results
        WHERE patient_id = ?
        ORDER BY id ASC
    """, (patient_id,))

    test_results = [dict(row) for row in cursor.fetchall()]

    conn.close()

    # Add all test results to patient data
    patient_data["test_results"] = test_results

    return patient_data