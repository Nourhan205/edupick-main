import { useState } from "react";
import { API_URL } from "../config";
import { Link , useNavigate} from "react-router-dom";
import '../styles/common.css';
import '../styles/auth.css';
import logo from '../assets/logo2-removebg.png';

function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setMessage("Passwords do not match!");
      return;
    }

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    setMessage("");

   fetch(`${API_URL}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: localStorage.getItem("resetEmail"),
    password: password
  }),
    })
      .then((res) => {
        if (res.ok) {
          setMessage("Your password has been reset successfully!");
          setTimeout(() => navigate("/login"), 2000);
        } else {
          setMessage("Something went wrong. Try again later.");
        }
      })
      .catch(() => {
        setMessage("Network error. Please check your connection.");
      })
      .finally(() => setLoading(false));
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
        <h2>Reset Password</h2>
        <p>Enter your new password below</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">New Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="Enter new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Confirm New Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Updating..." : "Reset Password"}
          </button>
        </form>

        {message && <p className="message">{message}</p>}

        <div className="auth-links">
          <Link to="/login" className="auth-link">Back to Login</Link>
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;