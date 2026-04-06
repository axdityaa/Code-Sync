// import React, { useEffect, useRef } from 'react';
// import CodeMirror from 'codemirror';

// // CodeMirror base + C++ mode and features
// import 'codemirror/lib/codemirror.css';
// import 'codemirror/theme/dracula.css';
// import 'codemirror/mode/clike/clike'; // C, C++ support
// import 'codemirror/addon/edit/closetag';
// import 'codemirror/addon/edit/closebrackets';

// const Editor = ({ initialCode, onCodeChange, editorRef }) => {
//     const textAreaRef = useRef(null);

//     useEffect(() => {
//         // Initialize CodeMirror on textarea
//         editorRef.current = CodeMirror.fromTextArea(textAreaRef.current, {
//             mode: 'text/x-c++src',
//             theme: 'dracula',
//             lineNumbers: true,
//             autoCloseBrackets: true,
//             autoCloseTags: true,
//             tabSize: 4,
//             indentUnit: 4,
//             matchBrackets: true,
//         });

//         editorRef.current.setValue(initialCode || '');

//         editorRef.current.on('change', (instance) => {
//             const newCode = instance.getValue();
//             onCodeChange(newCode);
//         });

//         return () => {
//             if (editorRef.current) {
//                 editorRef.current.toTextArea();
//             }
//         };
//     }, []);

//     return (
//         <textarea ref={textAreaRef} />
//     );
// };

// export default Editor;




import React, { useEffect, useRef } from 'react';
import CodeMirror from 'codemirror';
import 'codemirror/lib/codemirror.css';
import 'codemirror/mode/clike/clike'; 
import 'codemirror/theme/material.css'; // Optional: dark theme

const Editor = ({ onChange, value, editorRef }) => {
  const editorContainerRef = useRef(null);
  const editorInstance = useRef(null);

  useEffect(() => {
    if (!editorContainerRef.current) return;

    // Create CodeMirror instance
    editorInstance.current = CodeMirror(editorContainerRef.current, {
      mode: 'text/x-c++src',
      theme: 'material', // Dark theme to match your design
      lineNumbers: true,
      lineWrapping: true,
      autoCloseBrackets: true,
      matchBrackets: true,
      indentUnit: 2,
      tabSize: 2,
      value: value || '',
    });

    // Set up change handler
    editorInstance.current.on('change', (instance) => {
      const code = instance.getValue();
      onChange(code);
    });

    // Expose editor instance to parent component
    if (editorRef) {
      editorRef.current = editorInstance.current;
    }

    return () => {
      if (editorInstance.current) {
        editorInstance.current.toTextArea();
      }
    };
  }, []);

  // Update editor value when prop changes (for socket updates)
  useEffect(() => {
    if (editorInstance.current && value !== undefined) {
      const currentValue = editorInstance.current.getValue();
      if (currentValue !== value) {
        editorInstance.current.setValue(value);
      }
    }
  }, [value]);

  return (
    <div 
      ref={editorContainerRef} 
      style={{ 
        height: '100%',
        width: '100%',
        fontSize: '14px',
      }} 
    />
  );
};

export default Editor;



// import React, { useEffect, useRef } from 'react';
// import Codemirror from 'codemirror';
// import 'codemirror/lib/codemirror.css';
// import 'codemirror/theme/dracula.css';
// import 'codemirror/mode/clike/clike'; // Import for C++
// import 'codemirror/addon/edit/closetag';
// import 'codemirror/addon/edit/closebrackets';
// import ACTIONS from '../Actions';

// const Editor = ({ socketRef, roomId, onCodeChange }) => {
//     const editorRef = useRef(null);
//     useEffect(() => {
//         async function init() {
//             editorRef.current = Codemirror.fromTextArea(
//                 document.getElementById('realtimeEditor'),
//                 {
//                     mode: 'text/x-c++src',
//                     theme: 'material',
//                     autoCloseTags: true,
//                     autoCloseBrackets: true,
//                     lineNumbers: true,
//                 }
//             );

//             editorRef.current.on('change', (instance, changes) => {
//                 const { origin } = changes;
//                 const code = instance.getValue();
//                 onCodeChange(code);
//                 if (origin !== 'setValue') {
//                     socketRef.current.emit(ACTIONS.CODE_CHANGE, {
//                         roomId,
//                         code,
//                     });
//                 }
//             });
//         }
//         init();
//     }, []);

//     useEffect(() => {
//         if (socketRef.current) {
//             socketRef.current.on(ACTIONS.CODE_CHANGE, ({ code }) => {
//                 if (code !== null) {
//                     editorRef.current.setValue(code);
//                 }
//             });
//         }

//         return () => {
//             socketRef.current.off(ACTIONS.CODE_CHANGE);
//         };
//     }, [socketRef.current]);

//     return <textarea id="realtimeEditor"></textarea>;
// };

// export default Editor;