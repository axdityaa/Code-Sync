

import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import axios from 'axios';
import { Controlled as CodeMirror } from 'react-codemirror2';
// or
// import { UnControlled as CodeMirror } from 'react-codemirror2';

// Then your CSS and mode imports
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/dracula.css';
import 'codemirror/mode/clike/clike';
import 'codemirror/addon/edit/closebrackets';
import 'codemirror/addon/display/placeholder';
import 'codemirror/addon/fold/foldcode';
import 'codemirror/addon/fold/foldgutter.css';
import 'codemirror/addon/fold/foldgutter';



const ACTIONS = {
    JOIN: 'join',
    JOINED: 'joined',
    DISCONNECTED: 'disconnected',
    CODE_CHANGE: 'code-change',
    SYNC_CODE: 'sync-code',
    LEAVE: 'leave',
};

const EditorPage = () => {
    const socketRef = useRef(null);
    const codeRef = useRef(null);
    const location = useLocation();
    const { roomId } = useParams();
    const navigate = useNavigate();

    const [clients, setClients] = useState([]);
    const [code, setCode] = useState('// Welcome to the collaborative editor!\n\n');

    useEffect(() => {
        const init = async () => {
            // Initialize socket connection
            socketRef.current = io(process.env.REACT_APP_SOCKET_URL || window.location.origin); // Your server URL
            
            socketRef.current.on('connect_error', (err) => handleErrors(err));
            
            socketRef.current.emit(ACTIONS.JOIN, {
                roomId,
                username: location.state?.username,
            });

            // Listen for new users joining
            socketRef.current.on(ACTIONS.JOINED, ({ clients, username, socketId }) => {
                if (username !== location.state?.username) {
                    toast.success(`${username} joined the room.`);
                    console.log(`${username} joined`);
                }
                setClients(clients);
                
                // Sync code to new user
                socketRef.current.emit(ACTIONS.SYNC_CODE, {
                    code: codeRef.current,
                    socketId,
                });
            });

            // Listen for users disconnecting
            socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId, username }) => {
                toast.success(`${username} left the room.`);
                setClients((prev) => {
                    return prev.filter(client => client.socketId !== socketId);
                });
            });

            // Listen for code changes
            socketRef.current.on(ACTIONS.CODE_CHANGE, ({ code }) => {
                if (code !== null) {
                    setCode(code);
                    codeRef.current = code;
                }
            });
        };

        init();

        return () => {
            socketRef.current.disconnect();
            socketRef.current.off(ACTIONS.JOINED);
            socketRef.current.off(ACTIONS.DISCONNECTED);
            socketRef.current.off(ACTIONS.CODE_CHANGE);
        };
    }, [roomId, location.state?.username]);

    const handleErrors = (e) => {
        console.log('Socket error:', e);
        toast.error('Socket connection failed, try again later.');
        navigate('/');
    };

    const handleCodeChange = (newCode) => {
        setCode(newCode);
        codeRef.current = newCode;
        
        // Emit code change to other users
        socketRef.current.emit(ACTIONS.CODE_CHANGE, {
            roomId,
            code: newCode,
        });
    };

    const copyRoomId = async () => {
        try {
            await navigator.clipboard.writeText(roomId);
            toast.success('Room ID has been copied to your clipboard');
        } catch (err) {
            toast.error('Could not copy the Room ID');
            console.error(err);
        }
    };
        const downloadCode = () => {
        const element = document.createElement('a');
        const file = new Blob([codeRef.current], { type: 'text/plain' });
        element.href = URL.createObjectURL(file);
        element.download = `code-${roomId}-${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
        toast.success('Code downloaded successfully!');
    };
    const [aiInput, setAiInput] = useState('');

    const handleAISuggestion = async () => {
    try {
        const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';

        const fullPrompt = `${codeRef.current}\n\n// Instruction:\n${aiInput}`;

        const res = await axios.post(
            `${backendUrl}/api/v1/ai/suggest`,
            { prompt: fullPrompt },
            { headers: { 'Content-Type': 'application/json' } }
        );

        const data = res.data;
        if (data.success) {
            const newCode = codeRef.current + '\n' + data.suggestion;
            setCode(newCode);
            codeRef.current = newCode;

            socketRef.current.emit(ACTIONS.CODE_CHANGE, {
                roomId,
                code: newCode,
            });

            toast.success('AI suggestion added');
            setAiInput(''); // clear input
        } else {
            toast.error('AI failed: ' + data.message);
        }
    } catch (err) {
        console.error(err);
        toast.error('AI error occurred');
    }
};

    const leaveRoom = () => {
        navigate('/home');
    };

    if (!location.state) {
        navigate('/');
        return null;
    }
        return (
        <div className="editorPageContainer">
            {/* Sidebar */}
            <div className="editorSidebar">
                <div className="sidebarContent">
                    <div className="logoSection">
                        <img className="logoImage" src="/code-sync.png" alt="logo" />
                    </div>
                    
                    <h3 className="connectedUsersTitle">Connected Users</h3>
                    
                    <div className="clientsList">
                        {clients.map((client) => (
                            <div key={client.socketId} className="clientItem">
                                <span>{client.username}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="sidebarButtons">
                    <button className="sidebarBtn copyBtn" onClick={copyRoomId}>
                        Copy Room ID
                    </button>
                    
                    <button className="sidebarBtn downloadBtn" onClick={downloadCode}>
                        📥 Download Code
                    </button>
                    
                    <button className="sidebarBtn leaveBtn" onClick={leaveRoom}>
                        Leave Room
                    </button>
                </div>
            </div>

            {/* Main Editor Area */}
            <div className="editorMainArea">
                {/* CodeMirror Editor */}
                {/* <div className="editorContainer">
                    <textarea
                    value={code}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    placeholder="Start typing your code here..."
                    style={{
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        outline: 'none',
                        fontSize: '16px',
                        fontFamily: 'monospace',
                        padding: '20px',
                        backgroundColor: '#1e1e1e',
                        color: '#fff',
                        resize: 'none'
                    }}
                />
                </div> */}
                <div className="editorContainer">
                        {/* <CodeMirror
                        value={code}
                        height="100%"
                        extensions={[
                            cpp(),
                            lineNumbers(),
                            closeBrackets(),
                            keymap.of([...defaultKeymap, ...closeBracketsKeymap]),
                            EditorView.lineWrapping,
                            dracula
                        ]}
                        onChange={(value) => handleCodeChange(value)}
                        style={{ fontSize: '16px', fontFamily: 'monospace' }}
                        /> */}
                        <CodeMirror
  value={code}
  options={{
    mode: 'text/x-c++src',
    theme: 'dracula',
    lineNumbers: true,
    autoCloseBrackets: true,
    matchBrackets: true,
    lineWrapping: true,
    indentUnit: 4,
    tabSize: 4,
    indentWithTabs: false,
    foldGutter: true, // Enable code folding
    gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
    extraKeys: {
      'Ctrl-Space': 'autocomplete',
      'Tab': 'indentMore',
      'Shift-Tab': 'indentLess'
    }
  }}
  onBeforeChange={(editor, data, value) => handleCodeChange(value)}
/>
                    </div>



                {/* AI Input Section - Fixed at bottom */}
                <div className="aiInputSection">
                    <textarea
                        value={aiInput}
                        onChange={(e) => setAiInput(e.target.value)}
                        placeholder="Describe what you want the AI to help with..."
                        className="aiTextarea"
                    />
                    <button 
                        onClick={handleAISuggestion}
                        disabled={!aiInput.trim()}
                        className="aiSuggestionBtn"
                    >
                        💡 Get AI Suggestion
                    </button>
                </div>
            </div>
        </div>
    );

    // return (
    //     <div className="mainWrap">
    //         <div className="aside">
    //             <div className="asideInner">
    //                 <div className="logo">
    //                     <img className="logoImage" src="/code-sync.png" alt="logo" />
    //                 </div>
    //                 <h3>Connected</h3>
    //                 <div className="clientsList">
    //                     {clients.map((client) => (
    //                         <div key={client.socketId} className="client">
    //                             <span className="userName">{client.username}</span>
    //                         </div>
    //                     ))}
    //                 </div>
    //             </div>
    //             <button className="btn copyBtn" onClick={copyRoomId}>
    //                 Copy ROOM ID
    //             </button>
    //             <button className="btn leaveBtn" onClick={leaveRoom}>
    //                 Leave
    //             </button>



    //             {/* <button className="btn" onClick={handleAISuggestion}>💡 Get AI Suggestion</button> */}



    //         </div>
    //         <div className="editorWrap">
    //             <textarea
    //                 value={code}
    //                 onChange={(e) => handleCodeChange(e.target.value)}
    //                 placeholder="Start typing your code here..."
    //                 style={{
    //                     width: '100%',
    //                     height: '100%',
    //                     border: 'none',
    //                     outline: 'none',
    //                     fontSize: '16px',
    //                     fontFamily: 'monospace',
    //                     padding: '20px',
    //                     backgroundColor: '#1e1e1e',
    //                     color: '#fff',
    //                     resize: 'none'
    //                 }}
    //             />



    //             <div style={{ marginTop: '10px' }}>
    //     <textarea
    //         value={aiInput}
    //         onChange={(e) => setAiInput(e.target.value)}
    //         placeholder="Describe what you want the AI to help with..."
    //         style={{
    //             width: '100%',
    //             height: '80px',
    //             padding: '10px',
    //             fontSize: '14px',
    //             fontFamily: 'monospace',
    //             backgroundColor: '#2e2e2e',
    //             color: '#eee',
    //             border: '1px solid #444',
    //             borderRadius: '4px'
    //         }}
    //     />
    //     <button onClick={handleAISuggestion} style={{
    //         marginTop: '8px',
    //         padding: '8px 16px',
    //         backgroundColor: '#4caf50',
    //         color: '#fff',
    //         border: 'none',
    //         borderRadius: '4px',
    //         cursor: 'pointer'
    //     }}>
    //         Get AI Suggestion
    //     </button>
    // </div>



    //         </div>
    //     </div>
    // );
};

export default EditorPage;



// import React, { useState, useRef, useEffect } from 'react';
// import { useLocation, useNavigate, useParams } from 'react-router-dom';
// import { io } from 'socket.io-client';
// import toast from 'react-hot-toast';
// import axios from 'axios';
// import Editor from '../components/Editor';

// const ACTIONS = {
//     JOIN: 'join',
//     JOINED: 'joined',
//     DISCONNECTED: 'disconnected',
//     CODE_CHANGE: 'code-change',
//     SYNC_CODE: 'sync-code',
//     LEAVE: 'leave',
// };

// const EditorPage = () => {
//     const socketRef = useRef(null);
//     const codeRef = useRef(null);
//     const editorInstanceRef = useRef(null);
//     const location = useLocation();
//     const { roomId } = useParams();
//     const navigate = useNavigate();

//     const [clients, setClients] = useState([]);
//     const [code, setCode] = useState('// Welcome to the collaborative editor!\n\n');
//     const [aiInput, setAiInput] = useState('');

//     useEffect(() => {
//         const init = async () => {
//             // Initialize socket connection
//             socketRef.current = io(process.env.REACT_APP_SOCKET_URL || window.location.origin);
            
//             socketRef.current.on('connect_error', (err) => handleErrors(err));
            
//             socketRef.current.emit(ACTIONS.JOIN, {
//                 roomId,
//                 username: location.state?.username,
//             });

//             // Listen for new users joining
//             socketRef.current.on(ACTIONS.JOINED, ({ clients, username, socketId }) => {
//                 if (username !== location.state?.username) {
//                     toast.success(`${username} joined the room.`);
//                     console.log(`${username} joined`);
//                 }
//                 setClients(clients);
                
//                 // Sync code to new user
//                 socketRef.current.emit(ACTIONS.SYNC_CODE, {
//                     code: codeRef.current,
//                     socketId,
//                 });
//             });

//             // Listen for users disconnecting
//             socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId, username }) => {
//                 toast.success(`${username} left the room.`);
//                 setClients((prev) => {
//                     return prev.filter(client => client.socketId !== socketId);
//                 });
//             });

//             // Listen for code changes
//             socketRef.current.on(ACTIONS.CODE_CHANGE, ({ code }) => {
//                 if (code !== null) {
//                     setCode(code);
//                     codeRef.current = code;
//                     // Update CodeMirror editor if it exists
//                     if (editorInstanceRef.current) {
//                         editorInstanceRef.current.setValue(code);
//                     }
//                 }
//             });
//         };

//         init();

//         return () => {
//             socketRef.current.disconnect();
//             socketRef.current.off(ACTIONS.JOINED);
//             socketRef.current.off(ACTIONS.DISCONNECTED);
//             socketRef.current.off(ACTIONS.CODE_CHANGE);
//         };
//     }, [roomId, location.state?.username]);

//     const handleErrors = (e) => {
//         console.log('Socket error:', e);
//         toast.error('Socket connection failed, try again later.');
//         navigate('/');
//     };

//     const handleCodeChange = (newCode) => {
//         setCode(newCode);
//         codeRef.current = newCode;
        
//         // Emit code change to other users
//         socketRef.current.emit(ACTIONS.CODE_CHANGE, {
//             roomId,
//             code: newCode,
//         });
//     };

//     const copyRoomId = async () => {
//         try {
//             await navigator.clipboard.writeText(roomId);
//             toast.success('Room ID has been copied to your clipboard');
//         } catch (err) {
//             toast.error('Could not copy the Room ID');
//             console.error(err);
//         }
//     };

//     const downloadCode = () => {
//         const element = document.createElement('a');
//         const file = new Blob([codeRef.current], { type: 'text/plain' });
//         element.href = URL.createObjectURL(file);
//         element.download = `code-${roomId}-${new Date().toISOString().slice(0, 10)}.txt`;
//         document.body.appendChild(element);
//         element.click();
//         document.body.removeChild(element);
//         toast.success('Code downloaded successfully!');
//     };

//     const handleAISuggestion = async () => {
//         try {
//             const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';

//             const fullPrompt = `${codeRef.current}\n\n// Instruction:\n${aiInput}`;

//             const res = await axios.post(
//                 `${backendUrl}/api/v1/ai/suggest`,
//                 { prompt: fullPrompt },
//                 { headers: { 'Content-Type': 'application/json' } }
//             );

//             const data = res.data;
//             if (data.success) {
//                 const newCode = codeRef.current + '\n' + data.suggestion;
//                 setCode(newCode);
//                 codeRef.current = newCode;

//                 // Update CodeMirror editor
//                 if (editorInstanceRef.current) {
//                     editorInstanceRef.current.setValue(newCode);
//                 }

//                 socketRef.current.emit(ACTIONS.CODE_CHANGE, {
//                     roomId,
//                     code: newCode,
//                 });

//                 toast.success('AI suggestion added');
//                 setAiInput('');
//             } else {
//                 toast.error('AI failed: ' + data.message);
//             }
//         } catch (err) {
//             console.error(err);
//             toast.error('AI error occurred');
//         }
//     };

//     const leaveRoom = () => {
//         navigate('/home');
//     };

//     if (!location.state) {
//         navigate('/');
//         return null;
//     }

//     return (
//         <div className="editorPageContainer">
//             {/* Sidebar */}
//             <div className="editorSidebar">
//                 <div className="sidebarContent">
//                     <div className="logoSection">
//                         <img className="logoImage" src="/code-sync.png" alt="logo" />
//                     </div>
                    
//                     <h3 className="connectedUsersTitle">Connected Users</h3>
                    
//                     <div className="clientsList">
//                         {clients.map((client) => (
//                             <div key={client.socketId} className="clientItem">
//                                 <span>{client.username}</span>
//                             </div>
//                         ))}
//                     </div>
//                 </div>

//                 <div className="sidebarButtons">
//                     <button className="sidebarBtn copyBtn" onClick={copyRoomId}>
//                         Copy Room ID
//                     </button>
                    
//                     <button className="sidebarBtn downloadBtn" onClick={downloadCode}>
//                         📥 Download Code
//                     </button>
                    
//                     <button className="sidebarBtn leaveBtn" onClick={leaveRoom}>
//                         Leave Room
//                     </button>
//                 </div>
//             </div>

//             {/* Main Editor Area */}
//             <div className="editorMainArea">
//                 {/* CodeMirror Editor */}
//                 <div className="editorContainer">
//                     <Editor 
//                         value={code}
//                         onChange={handleCodeChange}
//                         editorRef={editorInstanceRef}
//                     />
//                 </div>

//                 {/* AI Input Section - Fixed at bottom */}
//                 <div className="aiInputSection">
//                     <textarea
//                         value={aiInput}
//                         onChange={(e) => setAiInput(e.target.value)}
//                         placeholder="Describe what you want the AI to help with..."
//                         className="aiTextarea"
//                     />
//                     <button 
//                         onClick={handleAISuggestion}
//                         disabled={!aiInput.trim()}
//                         className="aiSuggestionBtn"
//                     >
//                         💡 Get AI Suggestion
//                     </button>
//                 </div>
//             </div>
//         </div>
//     );
// };

// export default EditorPage;







// import React, { useState, useRef, useEffect } from 'react';
// import toast from 'react-hot-toast';
// import ACTIONS from '../Actions';
// import Client from '../components/Client';
// import Editor from '../components/Editor';
// import { initSocket } from '../socket';
// import {
//     useLocation,
//     useNavigate,
//     Navigate,
//     useParams,
// } from 'react-router-dom';
// import axios from 'axios';

// const EditorPage = () => {
//     const socketRef = useRef(null);
//     const codeRef = useRef(null);
//     const location = useLocation();
//     const { roomId } = useParams();
//     const reactNavigator = useNavigate();
//     const [clients, setClients] = useState([]);

//     useEffect(() => {
//         const init = async () => {
//             socketRef.current = await initSocket();
//             socketRef.current.on('connect_error', (err) => handleErrors(err));
//             socketRef.current.on('connect_failed', (err) => handleErrors(err));

//             function handleErrors(e) {
//                 console.log('socket error', e);
//                 toast.error('Socket connection failed, try again later.');
//                 reactNavigator('/');
//             }

//             socketRef.current.emit(ACTIONS.JOIN, {
//                 roomId,
//                 username: location.state?.username,
//             });

//             // Listening for joined event
//             socketRef.current.on(
//                 ACTIONS.JOINED,
//                 ({ clients, username, socketId }) => {
//                     if (username !== location.state?.username) {
//                         toast.success(`${username} joined the room.`);
//                         console.log(`${username} joined`);
//                     }
//                     setClients(clients);
//                     socketRef.current.emit(ACTIONS.SYNC_CODE, {
//                         code: codeRef.current,
//                         socketId,
//                     });
//                 }
//             );

//             // Listening for disconnected
//             socketRef.current.on(
//                 ACTIONS.DISCONNECTED,
//                 ({ socketId, username }) => {
//                     toast.success(`${username} left the room.`);
//                     setClients((prev) => {
//                         return prev.filter(
//                             (client) => client.socketId !== socketId
//                         );
//                     });
//                 }
//             );
//         };
//         init();
//         return () => {
//             socketRef.current.disconnect();
//             socketRef.current.off(ACTIONS.JOINED);
//             socketRef.current.off(ACTIONS.DISCONNECTED);
//         };
//     }, []);

//     // const handleErrors = (e) => {
//     //     console.log('Socket error:', e);
//     //     toast.error('Socket connection failed, try again later.');
//     //     navigate('/');
//     // };

//     // const handleCodeChange = (newCode) => {
//     //     setCode(newCode);
//     //     codeRef.current = newCode;
        
//     //     // Emit code change to other users
//     //     socketRef.current.emit(ACTIONS.CODE_CHANGE, {
//     //         roomId,
//     //         code: newCode,
//     //     });
//     // };

//     const copyRoomId = async () => {
//         try {
//             await navigator.clipboard.writeText(roomId);
//             toast.success('Room ID has been copied to your clipboard');
//         } catch (err) {
//             toast.error('Could not copy the Room ID');
//             console.error(err);
//         }
//     };

//     const downloadCode = () => {
//         const element = document.createElement('a');
//         const file = new Blob([codeRef.current], { type: 'text/plain' });
//         element.href = URL.createObjectURL(file);
//         element.download = `code-${roomId}-${new Date().toISOString().slice(0, 10)}.txt`;
//         document.body.appendChild(element);
//         element.click();
//         document.body.removeChild(element);
//         toast.success('Code downloaded successfully!');
//     };
//     const [aiInput, setAiInput] = useState('');
//     const handleAISuggestion = async () => {
//         try {
//             const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';

//             const fullPrompt = `${codeRef.current}\n\n// Instruction:\n${aiInput}`;

//             const res = await axios.post(
//                 `${backendUrl}/api/v1/ai/suggest`,
//                 { prompt: fullPrompt },
//                 { headers: { 'Content-Type': 'application/json' } }
//             );

//             const data = res.data;
//             if (data.success) {
//                 const newCode = codeRef.current + '\n' + data.suggestion;
//                 // setCode(newCode);
//                 codeRef.current = newCode;

//                 // Update CodeMirror editor
//                 // if (editorInstanceRef.current) {
//                 //     editorInstanceRef.current.setValue(newCode);
//                 // }

//                 socketRef.current.emit(ACTIONS.CODE_CHANGE, {
//                     roomId,
//                     code: newCode,
//                 });

//                 toast.success('AI suggestion added');
//                 setAiInput('');
//             } else {
//                 toast.error('AI failed: ' + data.message);
//             }
//         } catch (err) {
//             console.error(err);
//             toast.error('AI error occurred');
//         }
//     };

//     const leaveRoom = () => {
//         reactNavigator('/home');
//     };

//     if (!location.state) {
//         reactNavigator('/');
//         return null;
//     }

//     return (
//         <div className="editorPageContainer">
//             {/* Sidebar */}
//             <div className="editorSidebar">
//                 <div className="sidebarContent">
//                     <div className="logoSection">
//                         <img className="logoImage" src="/code-sync.png" alt="logo" />
//                     </div>
                    
//                     <h3 className="connectedUsersTitle">Connected Users</h3>
                    
//                     <div className="clientsList">
//                         {clients.map((client) => (
//                             <div key={client.socketId} className="clientItem">
//                                 <span>{client.username}</span>
//                             </div>
//                         ))}
//                     </div>
//                 </div>

//                 <div className="sidebarButtons">
//                     <button className="sidebarBtn copyBtn" onClick={copyRoomId}>
//                         Copy Room ID
//                     </button>
                    
//                     <button className="sidebarBtn downloadBtn" onClick={downloadCode}>
//                         📥 Download Code
//                     </button>
                    
//                     <button className="sidebarBtn leaveBtn" onClick={leaveRoom}>
//                         Leave Room
//                     </button>
//                 </div>
//             </div>

//             {/* Main Editor Area */}
//             <div className="editorMainArea">
//                 {/* CodeMirror Editor */}
//                 <div className="editorContainer">
//                     <Editor 
//                         socketRef={socketRef}
//                         roomId={roomId}
//                         onCodeChange={(code) => {
//                         codeRef.current = code;
//                     }}
//                     />
//                 </div>

//                 {/* AI Input Section - Fixed at bottom */}
//                 <div className="aiInputSection">
//                     <textarea
//                         value={aiInput}
//                         onChange={(e) => setAiInput(e.target.value)}
//                         placeholder="Describe what you want the AI to help with..."
//                         className="aiTextarea"
//                     />
//                     <button 
//                         onClick={handleAISuggestion}
//                         disabled={!aiInput.trim()}
//                         className="aiSuggestionBtn"
//                     >
//                         💡 Get AI Suggestion
//                     </button>
//                 </div>
//             </div>
//         </div>
//     );
// };

// export default EditorPage;



// import React, { useState, useRef, useEffect } from 'react';
// import { useLocation, useNavigate, useParams } from 'react-router-dom';
// import { io } from 'socket.io-client';
// import toast from 'react-hot-toast';
// import axios from 'axios';
// import Editor from '../components/Editor'; // CodeMirror editor component

// const ACTIONS = {
//     JOIN: 'join',
//     JOINED: 'joined',
//     DISCONNECTED: 'disconnected',
//     CODE_CHANGE: 'code-change',
//     SYNC_CODE: 'sync-code',
//     LEAVE: 'leave',
// };

// const EditorPage = () => {
//     const socketRef = useRef(null);
//     const codeRef = useRef('');
//     const editorInstanceRef = useRef(null);
//     const location = useLocation();
//     const { roomId } = useParams();
//     const navigate = useNavigate();

//     const [clients, setClients] = useState([]);
//     const [code, setCode] = useState('// Welcome to the collaborative editor!\n');
//     const [aiInput, setAiInput] = useState('');

//     useEffect(() => {
//         const init = async () => {
//             socketRef.current = io(process.env.REACT_APP_SOCKET_URL || window.location.origin);
            
//             socketRef.current.on('connect_error', handleErrors);
//             socketRef.current.emit(ACTIONS.JOIN, {
//                 roomId,
//                 username: location.state?.username,
//             });

//             socketRef.current.on(ACTIONS.JOINED, ({ clients, username, socketId }) => {
//                 if (username !== location.state?.username) {
//                     toast.success(`${username} joined the room.`);
//                 }
//                 setClients(clients);
//                 socketRef.current.emit(ACTIONS.SYNC_CODE, {
//                     socketId,
//                     code: codeRef.current,
//                 });
//             });

//             socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId, username }) => {
//                 toast.success(`${username} left the room.`);
//                 setClients((prev) => prev.filter(c => c.socketId !== socketId));
//             });

//             socketRef.current.on(ACTIONS.CODE_CHANGE, ({ code }) => {
//                 if (code !== null && code !== codeRef.current) {
//                     codeRef.current = code;
//                     setCode(code);
//                     if (editorInstanceRef.current) {
//                         editorInstanceRef.current.setValue(code);
//                     }
//                 }
//             });
//         };

//         init();

//         return () => {
//             socketRef.current.disconnect();
//             socketRef.current.off(ACTIONS.JOINED);
//             socketRef.current.off(ACTIONS.DISCONNECTED);
//             socketRef.current.off(ACTIONS.CODE_CHANGE);
//         };
//     }, [roomId, location.state?.username]);

//     const handleErrors = (err) => {
//         console.error('Socket error:', err);
//         toast.error('Socket connection failed, try again.');
//         navigate('/');
//     };

//     const handleCodeChange = (newCode) => {
//         setCode(newCode);
//         codeRef.current = newCode;
//         socketRef.current.emit(ACTIONS.CODE_CHANGE, {
//             roomId,
//             code: newCode,
//         });
//     };

//     const handleAISuggestion = async () => {
//         try {
//             const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';
//             const prompt = `${codeRef.current}\n\n// Instruction:\n${aiInput}`;
//             const res = await axios.post(`${backendUrl}/api/v1/ai/suggest`, { prompt });

//             if (res.data.success) {
//                 const newCode = `${codeRef.current}\n${res.data.suggestion}`;
//                 handleCodeChange(newCode);
//                 toast.success('AI suggestion added!');
//                 setAiInput('');
//             } else {
//                 toast.error('AI failed: ' + res.data.message);
//             }
//         } catch (err) {
//             console.error(err);
//             toast.error('Error fetching AI suggestion.');
//         }
//     };

//     const copyRoomId = async () => {
//         try {
//             await navigator.clipboard.writeText(roomId);
//             toast.success('Room ID copied!');
//         } catch {
//             toast.error('Failed to copy Room ID');
//         }
//     };

//     const downloadCode = () => {
//         const blob = new Blob([codeRef.current], { type: 'text/plain;charset=utf-8' });
//         const a = document.createElement('a');
//         a.href = URL.createObjectURL(blob);
//         a.download = `room-${roomId}.cpp`;
//         a.click();
//     };

//     const leaveRoom = () => navigate('/home');

//     if (!location.state) {
//         navigate('/');
//         return null;
//     }

//     return (
//         <div className="editorPageContainer">
//             {/* Sidebar */}
//             <div className="editorSidebar">
//                 <div className="sidebarContent">
//                     <div className="logoSection">
//                         <img className="logoImage" src="/code-sync.png" alt="logo" />
//                     </div>
//                     <h3 className="connectedUsersTitle">Connected Users</h3>
//                     <div className="clientsList">
//                         {clients.map((client) => (
//                             <div key={client.socketId} className="clientItem">
//                                 <span>{client.username}</span>
//                             </div>
//                         ))}
//                     </div>
//                 </div>
//                 <div className="sidebarButtons">
//                     <button className="sidebarBtn copyBtn" onClick={copyRoomId}>
//                         Copy Room ID
//                     </button>
//                     <button className="sidebarBtn downloadBtn" onClick={downloadCode}>
//                         📥 Download Code
//                     </button>
//                     <button className="sidebarBtn leaveBtn" onClick={leaveRoom}>
//                         Leave Room
//                     </button>
//                 </div>
//             </div>

//             {/* Editor Main Area */}
//             <div className="editorMainArea">
//                 <div className="editorContainer">
//                     <Editor
//                         initialCode={code}
//                         onCodeChange={handleCodeChange}
//                         editorRef={editorInstanceRef}
//                     />
//                 </div>

//                 {/* AI Suggestion Input */}
//                 <div className="aiInputSection">
//                     <textarea
//                         value={aiInput}
//                         onChange={(e) => setAiInput(e.target.value)}
//                         placeholder="Describe what you want the AI to help with..."
//                         className="aiTextarea"
//                     />
//                     <button
//                         onClick={handleAISuggestion}
//                         disabled={!aiInput.trim()}
//                         className="aiSuggestionBtn"
//                     >
//                         💡 Get AI Suggestion
//                     </button>
//                 </div>
//             </div>
//         </div>
//     );
// };

// export default EditorPage;
