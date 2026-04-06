import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';
      console.log('Backend URL:', backendUrl); // For debugging
      
      const res = await axios.post(
        `${backendUrl}/api/v1/auth/login`, { email, password }, { withCredentials: true });
      if (res.data.success) {
        navigate('/home');
      }
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Login failed';
      alert(message);
    }
  };

  return (
    <div className="authForm">
      <h2>Login</h2>
      <input type="email" placeholder="Email" onChange={e => setEmail(e.target.value)} />
      <input type="password" placeholder="Password" onChange={e => setPassword(e.target.value)} />
      <button onClick={handleLogin}>Login</button>
    </div>
  );
};

export default Login;
