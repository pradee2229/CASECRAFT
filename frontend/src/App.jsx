import { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";
const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [ocrText, setOcrText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [page, setPage] = useState("home");
  const [patient, setPatient] = useState({
    name: "",
    age: "",
    gender: "",
    phone: "",
    complaint: "",
    symptoms: "",
    duration: "",
    history: "",
    medications: "",
    allergies: "",
  });

  const [message, setMessage] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [patients, setPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);
  useEffect(() => {
    axios
      .get(`${API_URL}/patients`)
      .then((response) => {
        setPatients(response.data);
      })
      .catch((error) => {
         console.error("Unable to load dashboard data:", error);
      });
  }, []);
  const handleChange = (e) => {
    setPatient({
      ...patient,
      [e.target.name]: e.target.value,
    });
  };

  const testBackend = async () => {
    try {
      const response = await axios.get(`${API_URL}/`);
      setMessage(response.data.message);
    } catch {
      setMessage("Backend connection failed");
    }
  };
  const uploadReport = async () => {
  if (!selectedFile) {
    alert("Please select a medical report first.");
    return;
  }

  const formData = new FormData();
  formData.append("file", selectedFile);

  try {
    setUploading(true);
    setOcrText("");

    const response = await axios.post(
      `${API_URL}/upload-report`,
      formData
    );
    setOcrText(response.data.text || "No text detected.");
    const analysis = await axios.post(
  `${API_URL}/analyze-report`,
  {
    text: response.data.text
  }
);

localStorage.setItem(
  "medicalAnalysis",
  JSON.stringify(analysis.data)
);
setAnalysis(analysis.data);
  } catch (error) {
    console.error(error);
    setOcrText("❌ OCR processing failed.");
  } finally {
    setUploading(false);
  }
};

  const startCase = () => {
    setPage("patient");
    setMessage("");
  };
  const generateHistory = async () => {

  try {

    const report = analysis || {};

    const patientData = {
  name: patient.name || report.patient_name || "",
  age: patient.age || report.age || "",
  gender: patient.gender || report.gender || "",
  phone: patient.phone || "",
  complaint: patient.complaint || "",
  symptoms: patient.symptoms || "",
  duration: patient.duration || "",
  history: patient.history || "",
  medications: patient.medications || "",
  allergies: patient.allergies || "",
  report_text: ocrText || "",

  // Keep existing patient table fields
  test: report.results?.map(r => r.test).join(", ") || "",
  result: report.results?.map(r => r.result).join(", ") || "",
  reference_range: report.results?.map(r => r.reference_range).join(", ") || "",
  unit: report.results?.map(r => r.unit).join(", ") || "",
  alert: report.results?.map(r => r.alert).join(" | ") || "",

  priority:
    report.results?.some(r => r.priority === "CRITICAL")
      ? "CRITICAL"
      : report.results?.some(r => r.priority === "ATTENTION REQUIRED")
        ? "ATTENTION REQUIRED"
        : "NORMAL",

  // Save every individual laboratory result
  results: report.results || []
};

    const response = await axios.post(
       `${API_URL}/save-patient`,
        patientData
    );

    alert(
      `Patient summary saved successfully!\nPatient ID: ${response.data.patient_id}`
    );

    setPage("summary");

  } catch (error) {

    console.error(error);

    alert("Failed to save patient summary.");
  }
};
const showPatients = async () => {

  try {

    const response = await axios.get(
      `${API_URL}/patients`
    );

    setPatients(response.data);
    setPage("records");

  } catch (error) {

    console.error(error);

    alert("Unable to load patient records.");
  }
};
const showPatientDetails = async (patientId) => {
  try {
    const response = await axios.get(
      `${API_URL}/patients/${patientId}`
    );
    setSelectedPatient(response.data);
    setPage("patient-detail");

  } catch (error) {
    console.error(error);
    alert("Unable to load patient details.");
  }
};
if (page === "records") {
  return (
    <div className="app">

      <header>
        <h1>CaseCraft</h1>
        <p>AI-Powered Patient Case-Taking Software</p>
      </header>

      <nav>
        <button onClick={() => setPage("home")}>
          Home
        </button>

        <button onClick={startCase}>
          New Patient
        </button>

        <button className="active">
          Patient Records
        </button>
      </nav>

      <main className="summary-container">

        <h2>👨‍⚕️ Patient Records</h2>

        <p className="subtitle">
          Previously saved patient cases
        </p>
        <div className="search-box">
          <input
            type="text"
            placeholder="🔍 Search by name, ID or test..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {patients.length === 0 ? (

          <div className="summary-card">
            <h3>No patient records found</h3>
            <p>
              Create a new patient case to see it here.
            </p>
          </div>

        ) : (

          <div className="summary-card">

            <table className="patient-table">

              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Age</th>
                  <th>Gender</th>
                  <th>Test</th>
                  <th>Result</th>
                  <th>Reference Range</th>
                  <th>Status</th>
                  <th>Priority</th>
                </tr>
              </thead>

              <tbody>
                {patients
                  .filter((p) => {
                    const search = searchTerm.toLowerCase();

                    return (
                      String(p.id).includes(search) ||
                      (p.name || "").toLowerCase().includes(search) ||
                      (p.test || "").toLowerCase().includes(search) ||
                      (p.test_results || []).some((result) =>
                        (result.test || "").toLowerCase().includes(search)
                      )
                    );
                  })
                  .map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => showPatientDetails(p.id)}
                      className="clickable-row"
                    >

                    <td>{p.id}</td>

                    <td>
                      {p.name || "Not provided"}
                    </td>

                    <td>
                      {p.age || "-"}
                    </td>

                    <td>
                      {p.gender || "-"}
                    </td>

                    {/* TEST */}
                    <td>
                      {p.test_results && p.test_results.length > 0 ? (
                        p.test_results.map((result, index) => (
                          <div key={result.id || index} className="record-item">
                            <strong>{result.test || "-"}</strong>
                          </div>
                        ))
                      ) : (
                        p.test || "-"
                      )}
                    </td>

                    {/* RESULT */}
                    <td>
                      {p.test_results && p.test_results.length > 0 ? (
                        p.test_results.map((result, index) => (
                          <div key={result.id || index} className="record-item">
                            {result.result || "-"} {result.unit || ""}
                          </div>
                       ))
                     ) : (
                       <>
                         {p.result || "-"} {p.unit || ""}
                       </>
                     )}
                    </td>

                    {/* REFERENCE RANGE */}
                    <td>
                      {p.test_results && p.test_results.length > 0 ? (
                        p.test_results.map((result, index) => (
                          <div key={result.id || index} className="record-item">
                            {result.reference_range || "-"}
                          </div>
                        ))
                      ) : (
                        p.reference_range || "-"
                      )}
                    </td>

                    {/* STATUS */}
                    <td>
                      {p.test_results && p.test_results.length > 0 ? (
                        p.test_results.map((result, index) => (
                          <div key={result.id || index} className="record-item">
                            {result.status || "-"}
                          </div>
                        ))
                      ) : (
                        p.status || "-"
                      )}
                    </td>

                    {/* PRIORITY */}
                    <td>
                      {p.test_results && p.test_results.length > 0 ? (
                        p.test_results.map((result, index) => (
                          <div
                            key={result.id || index}
                            className={`record-item ${
                              result.priority === "CRITICAL"
                                ? "priority-critical"
                                : result.priority === "ATTENTION REQUIRED"
                                   ? "priority-attention"
                                   : "priority-normal"
                           }`}
                          >
                           {result.priority || "NORMAL"}
                          </div>
                        ))
                      ) : (
                        p.priority || "NORMAL"
                      )}
                    </td>

                  </tr>
                ))}
              </tbody>

            </table>

          </div>
        )}

      </main>

    </div>
  );
}
if (page === "patient-detail") {
  const p = selectedPatient;

  return (
    <div className="app">

      <header>
        <h1>CaseCraft</h1>
        <p>AI-Powered Patient Case-Taking Software</p>
      </header>

      <nav>
        <button onClick={() => setPage("home")}>
          Home
        </button>

        <button onClick={() => setPage("records")}>
          Patient Records
        </button>

        <button className="active">
          Patient Details
        </button>
      </nav>

      <main className="summary-container">

        <h2>👤 Patient Details</h2>

        {p && (
          <>
            <div className="summary-card">
              <h3>Patient Information</h3>

              <p><strong>Patient ID:</strong> {p.id}</p>
              <p><strong>Name:</strong> {p.name || "Not provided"}</p>
              <p><strong>Age:</strong> {p.age || "Not provided"}</p>
              <p><strong>Gender:</strong> {p.gender || "Not provided"}</p>
              <p><strong>Phone:</strong> {p.phone || "Not provided"}</p>
            </div>

            <div className="summary-card">
              <h3>🩺 Clinical Information</h3>

              <p>
                <strong>Chief Complaint:</strong>{" "}
                {p.complaint || "Not provided"}
              </p>

              <p>
                <strong>Symptoms:</strong>{" "}
                {p.symptoms || "Not provided"}
              </p>

              <p>
                <strong>Duration:</strong>{" "}
                {p.duration || "Not provided"}
              </p>

              <p>
                <strong>Previous Medical History:</strong>{" "}
                {p.history || "Not provided"}
              </p>

              <p>
                <strong>Current Medications:</strong>{" "}
                {p.medications || "Not provided"}
              </p>

              <p>
                <strong>Allergies:</strong>{" "}
                {p.allergies || "Not provided"}
              </p>
            </div>

            <div className="summary-card">
              <h3>📊 Laboratory Results</h3>

              {p.test_results && p.test_results.length > 0 ? (
                p.test_results.map((result, index) => (
                  <div className="medical-test" key={result.id || index}>

                    <p>
                      <strong>Test:</strong>{" "}
                      {result.test || "-"}
                    </p>

                    <p>
                      <strong>Result:</strong>{" "}
                      {result.result || "-"}{" "}
                      {result.unit || ""}
                    </p>

                    <p>
                      <strong>Reference Range:</strong>{" "}
                      {result.reference_range || "-"}{" "}
                      {result.unit || ""}
                    </p>

                    <p>
                      <strong>Status:</strong>{" "}
                      {result.status || "-"}
                    </p>

                    <p>
                      <strong>Priority:</strong>{" "}
                      {result.priority || "NORMAL"}
                    </p>

                    <div className="alert-box">
                      ⚠️ {result.alert || "No alert"}
                    </div>

                    {index < p.test_results.length - 1 && <hr />}

                  </div>
                ))
              ) : (
                <p>No laboratory results available.</p>
              )}
            </div>

            <div className="summary-card">
              <h3>🤖 Clinical Summary</h3>

              <p>
                The patient's clinical information and available
                laboratory results have been organized from the
                saved medical case.
              </p>

              <p>
                <strong>Overall Priority:</strong>{" "}
                {p.priority || "NORMAL"}
              </p>

              <p className="summary-note">
                This information is automatically organized from
                the patient case and uploaded medical report.
                The doctor should correlate these findings with
                clinical examination and complete medical history.
              </p>

              <p className="disclaimer">
                ⚕️ AI-assisted summary — not a diagnosis.
              </p>
            </div>

            <button
              className="primary"
              onClick={() => setPage("records")}
            >
              ← Back to Patient Records
            </button>
            <button
              className="secondary"
              onClick={() => window.print()}
            >
              🖨️ Print Patient Case
            </button>
          </>
        )}

      </main>
    </div>
  );
}
if (page === "summary") {
  const report = analysis;

  return (
    <div className="app">
      <header>
        <h1>CaseCraft</h1>
        <p>AI-Powered Patient Case-Taking Software</p>
      </header>

      <nav>
        <button onClick={() => setPage("home")}>Home</button>
        <button onClick={() => setPage("patient")}>
          Edit Patient
        </button>
        <button className="active">Patient Summary</button>
      </nav>

      <main className="summary-container">

        <h2>Patient Clinical Summary</h2>

        <div className="summary-card">
          <h3>👤 Patient Information</h3>

          <p><strong>Name:</strong> {patient.name || report?.patient_name}</p>
          <p><strong>Age:</strong> {patient.age || report?.age}</p>
          <p><strong>Gender:</strong> {patient.gender || report?.gender}</p>
          <p><strong>Phone:</strong> {patient.phone || "Not provided"}</p>
        </div>

        <div className="summary-card">
          <h3>🩺 Clinical Information</h3>

          <p>
            <strong>Chief Complaint:</strong>{" "}
            {patient.complaint || "Not provided"}
          </p>

          <p>
            <strong>Symptoms:</strong>{" "}
            {patient.symptoms || "Not provided"}
          </p>

          <p>
            <strong>Duration:</strong>{" "}
            {patient.duration || "Not provided"}
          </p>

          <p>
            <strong>Previous Medical History:</strong>{" "}
            {patient.history || "Not provided"}
          </p>

          <p>
            <strong>Current Medications:</strong>{" "}
            {patient.medications || "Not provided"}
          </p>

          <p>
            <strong>Allergies:</strong>{" "}
            {patient.allergies || "Not provided"}
          </p>
        </div>

        {report?.results?.length > 0 && (
  <div className="summary-card">
    <h3>📊 Laboratory Report</h3>

    {report.results.map((item, index) => (
      <div className="medical-test" key={index}>

        <p>
          <strong>Test:</strong> {item.test}
        </p>

        <p>
          <strong>Result:</strong>{" "}
          {item.result} {item.unit}
        </p>

        <p>
          <strong>Reference Range:</strong>{" "}
          {item.reference_range} {item.unit}
        </p>

        <p>
          <strong>Status:</strong>{" "}
          {item.status}
        </p>

        <div className="alert-box">
          ⚠️ {item.alert}
        </div>

        {index < report.results.length - 1 && <hr />}

      </div>
    ))}
  </div>
)}

        <div className="summary-card">
  <h3>🤖 Doctor-Friendly Clinical Summary</h3>

  <p>
    <strong>Patient:</strong>{" "}
    {patient.name || report?.patient_name}
  </p>

  <p>
    <strong>Demographics:</strong>{" "}
    {patient.age || report?.age} years /{" "}
    {patient.gender || report?.gender}
  </p>

  {patient.complaint && (
    <p>
      <strong>Chief Complaint:</strong>{" "}
      {patient.complaint}
    </p>
  )}

  {patient.symptoms && (
    <p>
      <strong>Symptoms:</strong>{" "}
      {patient.symptoms}
    </p>
  )}

  {patient.duration && (
    <p>
      <strong>Duration:</strong>{" "}
      {patient.duration}
    </p>
  )}

  {report?.results?.map((item, index) => (
  <div key={index}>

    <p>
      <strong>Laboratory Finding:</strong>{" "}
      {item.test} = {item.result} {item.unit}
    </p>

    <p>
      <strong>Reference Range:</strong>{" "}
      {item.reference_range} {item.unit}
    </p>

    <p>
      <strong>Status:</strong>{" "}
      {item.status}
    </p>

    <div className="alert-box">
      ⚠️ <strong>Attention:</strong> {item.alert}
    </div>

  </div>
))}
  <p className="summary-note">
    The information above was automatically organized from
    patient-entered information and the uploaded medical report.
    The doctor should correlate these findings with clinical
    examination and complete medical history.
  </p>

  <p className="disclaimer">
    ⚕️ AI-assisted summary — not a diagnosis.
  </p>
</div>

        <button
          className="primary"
          onClick={() => window.print()}
        >
          🖨️ Print Summary
        </button>

      </main>
    </div>
  );
}

  if (page === "patient") {
    return (
      <div className="app">
        <header>
          <h1>CaseCraft</h1>
          <p>AI-Powered Patient Case-Taking Software</p>
        </header>

        <nav>
          <button onClick={() => setPage("home")}>Home</button>
          <button className="active">New Patient</button>
        </nav>

        <main className="form-container">
          <h2>New Patient</h2>
          <p className="subtitle">
            Enter the patient's basic clinical information
          </p>

          <div className="form-grid">
            <div>
              <label>Patient Name</label>
              <input
                name="name"
                value={patient.name}
                onChange={handleChange}
                placeholder="Enter patient name"
              />
            </div>

            <div>
              <label>Age</label>
              <input
                type="number"
                name="age"
                value={patient.age}
                onChange={handleChange}
                placeholder="Age"
              />
            </div>

            <div>
              <label>Gender</label>
              <select
                name="gender"
                value={patient.gender}
                onChange={handleChange}
              >
                <option value="">Select gender</option>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
            </div>

            <div>
              <label>Phone Number</label>
              <input
                name="phone"
                value={patient.phone}
                onChange={handleChange}
                placeholder="Phone number"
              />
            </div>
          </div>

          <div className="section">
            <h3>Clinical Information</h3>

            <label>Chief Complaint</label>
            <textarea
              name="complaint"
              value={patient.complaint}
              onChange={handleChange}
              placeholder="What is the patient's main problem?"
            />

            <label>Symptoms</label>
            <textarea
              name="symptoms"
              value={patient.symptoms}
              onChange={handleChange}
              placeholder="Describe symptoms..."
            />

            <label>Duration of Symptoms</label>
            <input
              name="duration"
              value={patient.duration}
              onChange={handleChange}
              placeholder="Example: 3 days"
            />

            <label>Previous Medical History</label>
            <textarea
              name="history"
              value={patient.history}
              onChange={handleChange}
              placeholder="Previous diseases, surgeries, etc."
            />

            <label>Current Medications</label>
            <textarea
              name="medications"
              value={patient.medications}
              onChange={handleChange}
              placeholder="List current medications..."
            />

            <label>Allergies</label>
            <textarea
              name="allergies"
              value={patient.allergies}
              onChange={handleChange}
              placeholder="Drug or food allergies..."
            />
          </div>

          <div className="upload-box">
  <h3>📄 Scan Medical Report</h3>

  <p>
    Upload a prescription or medical report and extract
    the text automatically using OCR.
  </p>

  <input
    type="file"
    accept="image/png,image/jpeg,image/jpg"
    onChange={(e) => setSelectedFile(e.target.files[0])}
  />

  {selectedFile && (
    <p>
      Selected: <b>{selectedFile.name}</b>
    </p>
  )}

  <button
    className="secondary"
    onClick={uploadReport}
    disabled={uploading}
  >
    {uploading
      ? "🔄 Processing..."
      : "🔍 Upload & Extract Text"}
  </button>
</div>

{analysis && (
  <div className="ocr-result">
    <h3>📝 Medical Report Analysis</h3>

    <div className="medical-data">
      <p>
        <strong>Patient Name:</strong>{" "}
        {analysis.patient_name}
      </p>

      <p>
        <strong>Age:</strong> {analysis.age}
      </p>

      <p>
        <strong>Gender:</strong> {analysis.gender}
      </p>

      <hr />

      {analysis.results?.map((item, index) => (
  <div className="medical-test" key={index}>

    <p>
      <strong>Test:</strong> {item.test}
    </p>

    <p>
      <strong>Result:</strong> {item.result} {item.unit}
    </p>

    <p>
      <strong>Reference Range:</strong>{" "}
      {item.reference_range} {item.unit}
    </p>

    <p>
      <strong>Status:</strong> {item.status}
    </p>

    <div className="alert-box">
      ⚠️ {item.alert}
    </div>

    <hr />

  </div>
))}
      </div>
    </div>
)}

          <button className="generate" onClick={generateHistory}>
  Generate Clinical History
</button>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <header>
       <h1>CaseCraft</h1>
        <p>AI-Powered Patient Case-Taking Software</p>
      </header>

      <nav>
  <button className="active">Home</button>

  <button onClick={startCase}>
    New Patient
  </button>

  <button onClick={startCase}>
    Scan Report
  </button>

  <button onClick={showPatients}>
  Patient Records
</button>
</nav>

      <main className="hero">
        <div className="dashboard">
          <div className="dashboard-card">
           <h3>👥 Total Patients</h3>
            <p>{patients.length}</p>
          </div>

          <div className="dashboard-card">
            <h3>🟢 Normal Cases</h3>
            <p>
              {patients.filter((p) => p.priority === "NORMAL").length}
            </p>
          </div>

          <div className="dashboard-card">
            <h3>🟠 Attention Required</h3>
            <p>
              {patients.filter((p) => p.priority === "ATTENTION REQUIRED").length}
            </p>
          </div>

          <div className="dashboard-card">
            <h3>🔴 Critical Cases</h3>
            <p>
              {patients.filter((p) => p.priority === "CRITICAL").length}
            </p>
          </div>
        </div>
        <h2>Smart Patient Case Taking</h2>

        <p>
          Convert patient information, prescriptions and medical reports
          into a structured clinical history.
        </p>

        <button className="primary" onClick={startCase}>
          Start New Case
        </button>

        <button className="backend" onClick={testBackend}>
          Test Backend Connection
        </button>

        {message && <div className="message">{message}</div>}
      </main>
    </div>
  );
}

export default App;