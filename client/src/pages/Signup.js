import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Signup = () => {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const navigate = useNavigate();

  const handleSignup = async () => {
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';
      
      const res = await axios.post(
        `${backendUrl}/api/v1/auth/signup`,  form);
      if (res.data.success) {
        navigate('/login');
      }
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Signup failed';
      alert(message);
    }
  };

  return (
    <div className="authForm">
      <h2>Signup</h2>
      <input type="text" placeholder="Name" onChange={e => setForm({ ...form, name: e.target.value })} />
      <input type="email" placeholder="Email" onChange={e => setForm({ ...form, email: e.target.value })} />
      <input type="password" placeholder="Password" onChange={e => setForm({ ...form, password: e.target.value })} />
      
      <button onClick={handleSignup}>Signup</button>
    </div>
  );
};

export default Signup;
