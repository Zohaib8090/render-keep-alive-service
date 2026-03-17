import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut 
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  deleteDoc, 
  doc 
} from 'firebase/firestore';

const API_URL = 'http://localhost:5000/api/urls';

function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [isLogin, setIsLogin] = useState(true);
  const [url, setUrl] = useState('');
  const [urls, setUrls] = useState([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;
    
    // Listen to changes in Firestore
    const q = query(collection(db, "urls"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUrls(data);
    });
    return unsubscribe;
  }, [user]);

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      alert(error.message);
    }
  };

  const addUrl = async (e) => {
    e.preventDefault();
    if (!url) return;
    try {
      await addDoc(collection(db, "urls"), {
        url,
        userId: user.uid,
        createdAt: new Date()
      });
      setUrl('');
      
      // Also notify backend (optional if backend polls DB)
      // fetch(API_URL, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ url, userId: user.uid })
      // });
    } catch (error) {
      console.error(error);
    }
  };

  const deleteUrl = async (id) => {
    try {
      await deleteDoc(doc(db, "urls", id));
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) return <div className="loading-spinner"></div>;

  if (!user) {
    return (
      <div className="glass-card">
        <h1>Keep Alive</h1>
        <p className="subtitle">{isLogin ? 'Welcome back! Log in to continue.' : 'Create an account to get started.'}</p>
        <form onSubmit={handleAuth}>
          <div className="input-group">
            <label>Email Address</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" required />
          </div>
          <div className="input-group">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <button type="submit">{isLogin ? 'Log In' : 'Sign Up'}</button>
          <button type="button" className="btn-secondary" onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Log In"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="glass-card" style={{ maxWidth: '100%', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h1>Dashboard</h1>
          <button onClick={() => signOut(auth)} className="delete-btn" style={{ margin: 0 }}>Logout</button>
        </div>
        <p className="subtitle" style={{ textAlign: 'left' }}>Add URLs you want to keep awake (Render, etc.)</p>
        
        <form onSubmit={addUrl} style={{ display: 'flex', gap: '1rem' }}>
          <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
            <input 
              type="url" 
              value={url} 
              onChange={(e) => setUrl(e.target.value)} 
              placeholder="https://your-app.onrender.com" 
              required 
            />
          </div>
          <button type="submit" style={{ width: 'auto', marginTop: 0, padding: '0.8rem 2rem' }}>Add</button>
        </form>
      </div>

      <div className="url-list">
        {urls.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#94a3b8' }}>No URLs added yet. Start by adding one above!</p>
        ) : (
          urls.map(item => (
            <div key={item.id} className="url-item">
              <div className="url-text">{item.url}</div>
              <button onClick={() => deleteUrl(item.id)} className="delete-btn">Delete</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default App;
