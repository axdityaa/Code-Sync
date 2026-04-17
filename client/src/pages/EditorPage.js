import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import axios from 'axios';
import { Controlled as CodeMirror } from 'react-codemirror2';

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
  ROOM_CLOSED: 'room-closed',
  CODE_CHANGE: 'code-change',
  SYNC_CODE: 'sync-code',
  ROOM_META: 'room-meta',
  WRITE_ACCESS_REQUEST: 'write-access-request',
  WRITE_ACCESS_UPDATE: 'write-access-update',
};

const EditorPage = () => {
  const socketRef = useRef(null);
  const codeRef = useRef('// Welcome to the collaborative editor!\n\n');
  const location = useLocation();
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [clients, setClients] = useState([]);
  const [code, setCode] = useState(codeRef.current);
  const [aiInput, setAiInput] = useState('');

  const [ownerSocketId, setOwnerSocketId] = useState(null);
  const [canWrite, setCanWrite] = useState(false);
  const [writeRequestSent, setWriteRequestSent] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);

  const username = location.state?.username;
  const roomLabel = location.state?.roomName || roomId;
  const joinMode = location.state?.joinMode || 'join';

  const handleErrors = (error) => {
    console.error('Socket error:', error);
    toast.error('Socket connection failed, try again later.');
    navigate('/');
  };

  const resolveLocalWriteAccess = (nextOwnerSocketId, nextClients, eventCanWrite) => {
    const selfSocketId = socketRef.current?.id;
    const selfClient = (nextClients || []).find((client) => client.socketId === selfSocketId);

    if (typeof selfClient?.canWrite === 'boolean') {
      return selfClient.canWrite;
    }

    if (nextOwnerSocketId && selfSocketId === nextOwnerSocketId) {
      return true;
    }

    return Boolean(eventCanWrite);
  };

  useEffect(() => {
    if (!location.state || !username) {
      navigate('/');
      return;
    }

    socketRef.current = io(process.env.REACT_APP_SOCKET_URL || window.location.origin);

    socketRef.current.on('connect_error', handleErrors);

    socketRef.current.emit(ACTIONS.JOIN, {
      roomId,
      username,
      joinMode,
    });

    socketRef.current.on(ACTIONS.JOINED, ({ clients, username: joinedUser, socketId, ownerSocketId, canWrite }) => {
      if (joinedUser !== username) {
        toast.success(`${joinedUser} joined the room.`);
      }

      setClients(clients || []);
      setOwnerSocketId(ownerSocketId || null);
      setCanWrite(resolveLocalWriteAccess(ownerSocketId, clients, canWrite));

      socketRef.current.emit(ACTIONS.SYNC_CODE, {
        code: codeRef.current,
        socketId,
      });
    });

    socketRef.current.on(ACTIONS.ROOM_META, ({ ownerSocketId, clients, canWrite }) => {
      setOwnerSocketId(ownerSocketId || null);
      setClients(clients || []);
      setCanWrite(resolveLocalWriteAccess(ownerSocketId, clients, canWrite));
    });

    socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId, username: leftUser }) => {
      toast.success(`${leftUser} left the room.`);
      setClients((prev) => prev.filter((client) => client.socketId !== socketId));
      setPendingRequests((prev) => prev.filter((req) => req.requesterSocketId !== socketId));
    });

    socketRef.current.on(ACTIONS.ROOM_CLOSED, ({ message }) => {
      toast.error(message || 'Room closed by owner.');
      navigate('/home');
    });

    socketRef.current.on(ACTIONS.CODE_CHANGE, ({ code }) => {
      if (typeof code === 'string') {
        setCode(code);
        codeRef.current = code;
      }
    });

    socketRef.current.on(ACTIONS.WRITE_ACCESS_REQUEST, ({ requesterSocketId, requesterUsername }) => {
      if (!requesterSocketId || !requesterUsername) {
        return;
      }

      setPendingRequests((prev) => {
        const exists = prev.some((req) => req.requesterSocketId === requesterSocketId);
        if (exists) {
          return prev;
        }
        return [...prev, { requesterSocketId, requesterUsername }];
      });

      toast('New write-access request received.');
    });

    socketRef.current.on(ACTIONS.WRITE_ACCESS_UPDATE, ({ canWrite, status, message, requesterSocketId, decision }) => {
      if (typeof canWrite === 'boolean') {
        setCanWrite(canWrite);
      }

      if (status === 'pending') {
        setWriteRequestSent(true);
      }

      if (status === 'accepted' || status === 'rejected' || status === 'denied') {
        setWriteRequestSent(false);
      }

      if (status === 'resolved' && requesterSocketId) {
        setPendingRequests((prev) => prev.filter((req) => req.requesterSocketId !== requesterSocketId));
        toast.success(`Request ${decision === 'accept' ? 'approved' : 'rejected'}.`);
      }

      if (message) {
        if (status === 'rejected' || status === 'denied') {
          toast.error(message);
        } else {
          toast.success(message);
        }
      }
    });

    return () => {
      if (!socketRef.current) {
        return;
      }

      socketRef.current.off('connect_error', handleErrors);
      socketRef.current.off(ACTIONS.JOINED);
      socketRef.current.off(ACTIONS.ROOM_META);
      socketRef.current.off(ACTIONS.DISCONNECTED);
      socketRef.current.off(ACTIONS.ROOM_CLOSED);
      socketRef.current.off(ACTIONS.CODE_CHANGE);
      socketRef.current.off(ACTIONS.WRITE_ACCESS_REQUEST);
      socketRef.current.off(ACTIONS.WRITE_ACCESS_UPDATE);
      socketRef.current.disconnect();
    };
  }, [roomId, username, joinMode, location.state, navigate]);

  const handleCodeChange = (newCode) => {
    if (!canWrite) {
      return;
    }

    setCode(newCode);
    codeRef.current = newCode;

    socketRef.current.emit(ACTIONS.CODE_CHANGE, {
      roomId,
      code: newCode,
    });
  };

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      toast.success('Room ID copied to clipboard.');
    } catch (error) {
      console.error(error);
      toast.error('Could not copy Room ID.');
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
    toast.success('Code downloaded successfully.');
  };

  const requestWriteAccess = () => {
    if (writeRequestSent) {
      return;
    }

    socketRef.current.emit(ACTIONS.WRITE_ACCESS_REQUEST, { roomId });
  };

  const resolveRequest = (requesterSocketId, decision) => {
    socketRef.current.emit(ACTIONS.WRITE_ACCESS_UPDATE, {
      roomId,
      requesterSocketId,
      decision,
    });
  };

  const handleAISuggestion = async () => {
    if (!canWrite) {
      toast.error('You need write access before using AI insert.');
      return;
    }

    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';
      const fullPrompt = `${codeRef.current}\n\n// Instruction:\n${aiInput}`;

      const response = await axios.post(
        `${backendUrl}/api/v1/ai/suggest`,
        { prompt: fullPrompt },
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (response.data?.success) {
        const newCode = `${codeRef.current}\n${response.data.suggestion}`;
        setCode(newCode);
        codeRef.current = newCode;

        socketRef.current.emit(ACTIONS.CODE_CHANGE, {
          roomId,
          code: newCode,
        });

        setAiInput('');
        toast.success('AI suggestion added.');
      } else {
        toast.error(`AI failed: ${response.data?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(error);
      const backendMessage = error?.response?.data?.message;
      toast.error(`AI error: ${backendMessage || 'Request failed.'}`);
    }
  };

  const leaveRoom = () => {
    navigate('/home');
  };

  const isOwner = socketRef.current?.id === ownerSocketId;

  return (
    <div className="editorPageContainer">
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
                <span className="clientRoleTag">
                  {client.socketId === ownerSocketId ? 'Owner' : client.canWrite ? 'Editor' : 'Viewer'}
                </span>
              </div>
            ))}
          </div>

          {isOwner && pendingRequests.length > 0 && (
            <div className="accessRequestsPanel">
              <h4 className="accessRequestsTitle">Write Access Requests</h4>
              {pendingRequests.map((request) => (
                <div key={request.requesterSocketId} className="requestItem">
                  <span className="requestName">{request.requesterUsername}</span>
                  <div className="requestActions">
                    <button
                      className="requestBtn acceptBtn"
                      onClick={() => resolveRequest(request.requesterSocketId, 'accept')}
                    >
                      Accept
                    </button>
                    <button
                      className="requestBtn rejectBtn"
                      onClick={() => resolveRequest(request.requesterSocketId, 'reject')}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="sidebarButtons">
          <button className="sidebarBtn copyBtn" onClick={copyRoomId}>
            Copy Room ID
          </button>

          <button className="sidebarBtn downloadBtn" onClick={downloadCode}>
            Download Code
          </button>

          {!isOwner && !canWrite && (
            <button
              className="sidebarBtn requestAccessBtn"
              onClick={requestWriteAccess}
              disabled={writeRequestSent}
            >
              {writeRequestSent ? 'Request Pending' : 'Request Write Access'}
            </button>
          )}

          <button className="sidebarBtn leaveBtn" onClick={leaveRoom}>
            Leave Room
          </button>
        </div>
      </div>

      <div className="editorMainArea">
        <div className="editorTopBar">
          <span className="editorTopBarText">Room: {roomLabel}</span>
          <span className={`editorModeTag ${canWrite ? 'canWrite' : 'readOnly'}`}>
            {isOwner ? 'Owner' : canWrite ? 'Write Access' : 'Read Only'}
          </span>
        </div>

        <div className="editorContainer">
          <CodeMirror
            value={code}
            options={{
              mode: 'text/x-c++src',
              theme: 'dracula',
              lineNumbers: true,
              autoCloseBrackets: true,
              matchBrackets: true,
              lineWrapping: true,
              scrollbarStyle: 'native',
              coverGutterNextToScrollbar: false,
              scrollPastEnd: false,
              fixedGutter: true,
              indentUnit: 4,
              tabSize: 4,
              indentWithTabs: false,
              foldGutter: true,
              readOnly: !canWrite,
              gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
              extraKeys: {
                Tab: 'indentMore',
                'Shift-Tab': 'indentLess',
              },
            }}
            onBeforeChange={(editor, data, value) => handleCodeChange(value)}
          />
        </div>

        <div className="aiInputSection">
          <textarea
            value={aiInput}
            onChange={(event) => setAiInput(event.target.value)}
            placeholder="Describe what you want the AI to help with..."
            className="aiTextarea"
            disabled={!canWrite}
          />
          <button
            onClick={handleAISuggestion}
            disabled={!aiInput.trim() || !canWrite}
            className="aiSuggestionBtn"
          >
            Get AI Suggestion
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditorPage;
