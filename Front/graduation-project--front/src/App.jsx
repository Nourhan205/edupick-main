import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Navbar from './components/Navbar';
import ChatWidget from './components/ChatWidget';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import Dashboard from './pages/Dashboard';
import ForgetPassword from './pages/ForgetPassword';
import ResetPassword from './pages/ResetPassword';
import Roadmap from './pages/Roadmap';
import Chatbot from './pages/Chatbot';
import ComparisonTool from './pages/ComparisonTool';
import Profile from './pages/Profile';
import Guide from './pages/Guide';
import Home from './pages/Home';
import Test from './pages/Test';
import MainTest from './pages/MainTest';
import TopicTest from './pages/TopicTest';
import PerviousResults from './pages/PreivousResults';
import TrackDiscovery from './pages/TrackDiscovery';
import CVAnalyzer from './pages/CVAnalyzer';
import './App.css';

const NO_NAV = ["/", "/login", "/signup", "/forgetPassword", "/reset-password"];

function Layout() {
  const { pathname } = useLocation();
  const showNav = !NO_NAV.includes(pathname);
  // Floating assistant on app pages, but not on the full chat page itself
  const showWidget = showNav && pathname !== "/chatbot";

  return (
    <>
      {showNav && <Navbar />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/forgetPassword" element={<ForgetPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/roadmap" element={<Roadmap />} />
        <Route path="/chatbot" element={<Chatbot />} />
        <Route path="/ComparisonTool" element={<ComparisonTool />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/how-to-use" element={<Guide />} />
        <Route path="/test" element={<Test />} />
        <Route path="/test/main-test" element={<MainTest />} />
        <Route path="/test/topic-test" element={<TopicTest />} />
        <Route path="/test/previous-results" element={<PerviousResults />} />
        <Route path="/discover" element={<TrackDiscovery />} />
        <Route path="/cv-analyzer" element={<CVAnalyzer />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      {showWidget && <ChatWidget />}
    </>
  );
}

function App() {
  return (
    <>
      <ToastContainer position="top-right" autoClose={3000} theme="dark" />
      <Layout />
    </>
  );
}

export default App;
