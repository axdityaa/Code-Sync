
import React, { useState } from 'react';
import { v4 as uuidV4 } from 'uuid';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import '../styles/App.css';
import axios from 'axios';

const Home = () => {
    const navigate = useNavigate();
    



    
  const handleLogout = async () => {
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';
      await axios.get(`${backendUrl}/api/v1/auth/logout`, {
        withCredentials: true,
      });
      navigate("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };





    const [roomId, setRoomId] = useState('');
    const [username, setUsername] = useState('');
    const [roomName, setRoomName] = useState('');
    const [isNewRoom, setIsNewRoom] = useState(false);

    const createNewRoom = (e) => {
        e.preventDefault();
        const id = uuidV4();
        setRoomId(id);
        setIsNewRoom(true);
        toast.success('New room ID generated. Enter room name and join.');
    };

    const joinRoom = () => {
        if (!roomId || !username) {
            toast.error('ROOM ID & username is required');
            return;
        }

        const finalRoomName = roomName.trim();

        if (isNewRoom && !finalRoomName) {
            toast.error('Room name is required for new room');
            return;
        }

        // Redirect to editor with room ID and username
        navigate(`/editor/${roomId}`, {
            state: {
                username,
                roomName: finalRoomName,
                joinMode: isNewRoom ? 'create' : 'join',
            },
        });

        setIsNewRoom(false);
    };

    const handleInputEnter = (e) => {
        if (e.code === 'Enter') {
            joinRoom();
        }
    };

    return (
        <div className="homePageWrapper">
            <div className="formWrapper">
                <img
                    className="homePageLogo"
                    src="/code-sync.png"
                    alt="code-sync-logo"
                />
                <h4 className="mainLabel">Collaborative Code Editor</h4>
                <div className="inputGroup">
                    <input
                        type="text"
                        className="inputBox"
                        placeholder="ROOM ID"
                        onChange={(e) => setRoomId(e.target.value)}
                        value={roomId}
                        onKeyUp={handleInputEnter}
                    />
                    <input
                        type="text"
                        className="inputBox"
                        placeholder="ROOM NAME (required for new room)"
                        onChange={(e) => setRoomName(e.target.value)}
                        value={roomName}
                        onKeyUp={handleInputEnter}
                    />
                    <input
                        type="text"
                        className="inputBox"
                        placeholder="USERNAME"
                        onChange={(e) => setUsername(e.target.value)}
                        value={username}
                        onKeyUp={handleInputEnter}
                    />
                    <button className="btn joinBtn" onClick={joinRoom}>
                        Join Room
                    </button>
                    <span className="createInfo">
                        If you don't have a room ID, create &nbsp;
                        <a
                            onClick={createNewRoom}
                            href="#"
                            className="createNewBtn"
                        >
                            new room
                        </a>
                    </span>
                    <button onClick={handleLogout} className="btn logoutBtn">
                      Logout
                      </button>
                </div>
            </div>
        </div>
    );
};

export default Home;