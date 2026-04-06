import React from 'react';
import { useNavigate } from 'react-router-dom';

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="landingContainer">
      <h1>Welcome to DevRoom</h1>
      <p>A real-time collaborative code editor built with React, Node.js, and Socket.IO.</p>
      <div>
        <button onClick={() => navigate('/login')}>Login</button>
        <button onClick={() => navigate('/signup')}>Signup</button>
      </div>
    </div>
  );
};

export default Landing;
