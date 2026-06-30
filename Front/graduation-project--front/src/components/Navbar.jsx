import { useNavigate, useLocation } from "react-router-dom";
import {
  FaThLarge, FaMicrophone, FaClipboardList, FaMapSigns,
  FaRegCommentDots, FaBalanceScale, FaRegUser, FaSignOutAlt,
  FaFileAlt,
} from "react-icons/fa";
import ThemeToggle from "./ThemeToggle";
import "./Navbar.css";
import logo from "../assets/logo2-removebg.png";

const LINKS = [
  { to: "/dashboard",      label: "Dashboard",   icon: <FaThLarge /> },
  { to: "/discover",       label: "Interview",   icon: <FaMicrophone /> },
  { to: "/test",           label: "Quiz",        icon: <FaClipboardList /> },
  { to: "/roadmap",        label: "Roadmap",     icon: <FaMapSigns /> },
  { to: "/cv-analyzer",    label: "CV Analyzer", icon: <FaFileAlt /> },
  { to: "/chatbot",        label: "Chatbot",     icon: <FaRegCommentDots /> },
  { to: "/ComparisonTool", label: "Compare",     icon: <FaBalanceScale /> },
  { to: "/profile",        label: "Profile",     icon: <FaRegUser /> },
];

export default function Navbar() {
  const navigate  = useNavigate();
  const { pathname } = useLocation();

  const handleLogout = () => {
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userName");
    localStorage.removeItem("token");
    navigate("/login");
  };

  const name = localStorage.getItem("userName") || localStorage.getItem("userEmail") || "User";

  return (
    <nav className="nb-nav">
      <div className="nb-brand" onClick={() => navigate("/dashboard")}>
        <img src={logo} alt="EduPick" className="nb-logo" />
      </div>

      <ul className="nb-links">
        {LINKS.map(({ to, label, icon }) => (
          <li key={to}>
            <button
              className={`nb-link${pathname === to ? " nb-link--active" : ""}`}
              onClick={() => navigate(to)}
            >
              <span className="nb-icon">{icon}</span>
              <span className="nb-label">{label}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="nb-right">
        <ThemeToggle />
        <span className="nb-user"><FaRegUser className="nb-user-icon" /> {name}</span>
        <button className="nb-logout" onClick={handleLogout} title="Log out">
          <FaSignOutAlt /> <span className="nb-logout-label">Logout</span>
        </button>
      </div>
    </nav>
  );
}
