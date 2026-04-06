// // src/components/ProtectedRoute.js
// import React, { useEffect, useState } from 'react';
// import { Navigate } from 'react-router-dom';
// import axios from 'axios';

// const ProtectedRoute = ({ children }) => {
//   const [isAuthenticated, setIsAuthenticated] = useState(null); // null means loading

//   useEffect(() => {
//     const verifyUser = async () => {
//       try {
//         const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';
//         const res = await axios.get(`${backendUrl}/api/v1/auth/test`, {
//           withCredentials: true,
//         });
//         setIsAuthenticated(true);
//       } catch (err) {
//         setIsAuthenticated(false);
//       }
//     };

//     verifyUser();
//   }, []);

//   if (isAuthenticated === null) return <div>Loading...</div>;

//   return isAuthenticated ? children : <Navigate to="/login" />;
// };

// export default ProtectedRoute;
// client/src/components/ProtectedRoute.js
import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import axios from 'axios';

const ProtectedRoute = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(null);

  useEffect(() => {
    const verifyUser = async () => {
      try {
        const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';
        await axios.get(`${backendUrl}/api/v1/auth/test`, {
          withCredentials: true,
        });
        setIsAuthenticated(true);
      } catch (err) {
        setIsAuthenticated(false);
      }
    };

    verifyUser();
  }, []);

  if (isAuthenticated === null) return <div>Loading...</div>;

  return isAuthenticated ? children : <Navigate to="/login" />;
};

export default ProtectedRoute;
