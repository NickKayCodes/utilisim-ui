import './App.css';
import { Link } from 'react-router-dom';

const App = () => {
  return (
    <div className="content">
      <nav className="nav-links">
        <Link to="/">Home</Link>
        <Link to="/login">Login</Link>
      </nav>
      <h1>Welcome to Utilisim</h1>
      <p>This is a utility application for financial literacy through debt management.</p>
    </div>
  );
};

export default App;
