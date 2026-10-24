// Isolated fictional fixtures. No production accounts or API requests.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {UserManagement} from '../components/UserManagement';
import '../index.css';
createRoot(document.getElementById('root')!).render(<><div style={{background:'#26394c',color:'white',padding:12}}>Design preview · fictional staff · no accounts are created</div><UserManagement/></>);
