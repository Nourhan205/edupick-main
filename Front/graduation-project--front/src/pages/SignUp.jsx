import { useState } from "react";
import { API_URL } from "../config";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import '../styles/common.css';
import '../styles/auth.css';
import logo from '../assets/logo2-removebg.png';

function SignUp() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [age, setAge] = useState("");
  const [status, setStatus] = useState("");          // "student" | "graduate"
  const [studyLevel, setStudyLevel] = useState("");  // "high_school" | "college"
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (!status) {
      toast.error("Please tell us if you're a student or a graduate");
      return;
    }

    if (status === "student" && !studyLevel) {
      toast.error("Please select your study level");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/signup`, { // <-- Flask backend
      method: "POST",
      headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, email, password, confirmPassword,
          age, status,
          study_level: status === "student" ? studyLevel : "",
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(data.message, { position: "top-right", autoClose: 2000 });
        setTimeout(() => navigate("/login"), 2000);
        } else {
          toast.error(data.error || "Registration failed!");
        }
    // eslint-disable-next-line no-unused-vars
    } catch (err) {
        toast.error("Network error, please try again.");
    }
  };

  return (
    <div className="signup-page">
      <div className="login-header">
       <div className="logo-container">
           <img src={logo} alt="EduPick Logo" className="auth-logo" />
           <h1 className="site-name">EduPick</h1>
        </div>
      </div>

      <div className="auth-card">
        <h2>Create Account</h2>
        <p>Join <strong>EduPick</strong> today and unlock your learning potential</p>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="fullName" className="form-label">Full Name</label>
            <input
              id="fullName"
              type="text"
              className="form-input"
              placeholder="Enter Your Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="email" className="form-label">Email</label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group password-group">
            <label htmlFor="password" className="form-label">Password</label>
            <input
              id="password"
              type="password"
              className="form-input"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword" className="form-label">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              className="form-input"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="age" className="form-label">Age</label>
            <input
              id="age"
              type="number"
              min="10"
              max="100"
              className="form-input"
              placeholder="e.g. 19"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">I am a…</label>
            <div className="su-choice-row">
              <button
                type="button"
                className={`su-choice${status === "student" ? " active" : ""}`}
                onClick={() => setStatus("student")}
              >
                🎓 Student
              </button>
              <button
                type="button"
                className={`su-choice${status === "graduate" ? " active" : ""}`}
                onClick={() => { setStatus("graduate"); setStudyLevel(""); }}
              >
                💼 Graduate
              </button>
            </div>
          </div>

          {status === "student" && (
            <div className="form-group">
              <label className="form-label">Study level</label>
              <div className="su-choice-row">
                <button
                  type="button"
                  className={`su-choice${studyLevel === "high_school" ? " active" : ""}`}
                  onClick={() => setStudyLevel("high_school")}
                >
                  🏫 High School
                </button>
                <button
                  type="button"
                  className={`su-choice${studyLevel === "college" ? " active" : ""}`}
                  onClick={() => setStudyLevel("college")}
                >
                  🏛️ College
                </button>
              </div>
            </div>
          )}

          <button className="btn-primary" type="submit">
            Sign Up
          </button>
        </form>
        
        <div className="auth-links">
          <p>Already have an account? <Link to="/login" className="auth-link">Login</Link></p>
        </div>
      </div>
    </div>
  );
}

export default SignUp;