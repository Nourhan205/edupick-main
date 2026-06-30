import { useState } from "react";
import { API_URL } from "../config";
import { Link, useNavigate } from "react-router-dom";
import "../styles/common.css";
import "../styles/auth.css";
import logo from "../assets/logo2-removebg.png";

function VerificationCode() {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();

    if (code.trim().length !== 6) {
      setMessage("Verification code must be 6 digits.");
      return;
    }

    setLoading(true);
    setMessage("");

    fetch(`${API_URL}/verification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: localStorage.getItem("resetEmail"), // الإيميل اللي المستخدم أدخله في صفحة forgot password
    code: code,
  }),
    })
      .then((res) => {
        if (res.ok) {
          setMessage("Code verified successfully!");
          setTimeout(() => navigate("/reset-password"), 1500);
        } else {
          setMessage("Invalid verification code. Please try again.");
        }
      })
      .catch(() => {
        setMessage("Network error. Please check your connection.");
      })
      .finally(() => setLoading(false));
  };

  const handleResend = () => {
    setResending(true);
    setMessage("");

    fetch(`${API_URL}/verification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user@example.com" }), 
    })
      .then((res) => {
        if (res.ok) {
          setMessage("A new verification code has been sent to your email.");
        } else {
          setMessage("Failed to resend code. Try again later.");
        }
      })
      .catch(() => {
        setMessage("Network error. Please check your connection.");
      })
      .finally(() => setResending(false));
  };

  return (
    <div className="login-page">
      <div className="login-header">
        <div className="logo-container">
          <img src={logo} alt="EduPick Logo" className="auth-logo" />
          <h1 className="site-name">EduPick</h1>
        </div>
      </div>

      <div className="auth-card">
        <h2>Verification Code</h2>
        <p>Enter the 6-digit code sent to your email</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Verification Code</label>
            <input
              type="text"
              className="form-input"
              placeholder="Enter your code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              maxLength={6}
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Verifying..." : "Verify Code"}
          </button>
        </form>

        {message && <p className="message">{message}</p>}

        <div className="auth-links">
          <p>
            Didn’t receive a code?{" "}
            <button
              onClick={handleResend}
              className="auth-link"
              disabled={resending}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#007bff",
              }}
            >
              {resending ? "Resending..." : "Resend"}
            </button>
          </p>
          <Link to="/login" className="auth-link">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default VerificationCode;
