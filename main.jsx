import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { Star, ArrowUpRight, Send, X, Settings2, LogOut, Image as ImageIcon } from 'lucide-react';
import './style.css';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = url && key && !url.includes('YOUR_PROJECT') ? createClient(url, key) : null;

const fallbackProfile = {
  nickname: '모킷',
  avatar_url: '',
  cover_url: '',
  bio: '익명으로 마음을 놓고 가는 곳'
};

function FloatingStars() {
  const stars = ['✦', '✧', '☆', '✷', '✹', '✸', '✺', '✵', '✶', '⋆', '✦', '✧'];
  return <div className="stars-layer" aria-hidden="true">
    {stars.map((s, i) => <span key={i} className={`float-star star-${i + 1}`}>{s}</span>)}
  </div>;
}

function App() {
  const [profile, setProfile] = useState(fallbackProfile);
  const [messages, setMessages] = useState(() => supabase ? [] : [{ id: 'demo-1', body: '모킷모치 테스트 메시지예요!', reply: '반가워요, 모킷이에요 ♡', created_at: new Date().toISOString() }]);
  const [screen, setScreen] = useState('profile');
  const [draft, setDraft] = useState('');
  const [admin, setAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [settings, setSettings] = useState(fallbackProfile);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const [replyDrafts, setReplyDrafts] = useState({});
  const bottomRef = useRef(null);
  
  const avatarFileRef = useRef(null);
const coverFileRef = useRef(null);
const [uploadingImage, setUploadingImage] = useState('');

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    async function load() {
      const [{ data: p }, { data: m }] = await Promise.all([
        supabase.from('mokit_profile').select('*').eq('id', 1).maybeSingle(),
        supabase.from('mokit_messages').select('*').order('created_at', { ascending: true }).limit(150)
      ]);
      if (!alive) return;
      if (p) { setProfile(p); setSettings(p); }
      if (m) setMessages(m);
    }
    load();
    const channel = supabase.channel('mokit-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mokit_profile' }, payload => {
        if (payload.new) { setProfile(payload.new); setSettings(payload.new); }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mokit_messages' }, payload => {
        if (payload.eventType === 'INSERT') setMessages(prev => prev.some(x => x.id === payload.new.id) ? prev : [...prev, payload.new].slice(-150));
        if (payload.eventType === 'UPDATE') setMessages(prev => prev.map(x => String(x.id) === String(payload.new.id) ? payload.new : x));
        if (payload.eventType === 'DELETE') setMessages(prev => prev.filter(x => String(x.id) !== String(payload.old.id)));
      }).subscribe();
    supabase.auth.getSession().then(({ data }) => setAdmin(!!data.session));
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => setAdmin(!!session));
    return () => { alive = false; supabase.removeChannel(channel); authListener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (screen === 'chat') bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, screen]);

  const showToast = (msg) => { setNotice(msg); setTimeout(() => setNotice(''), 2600); };

  async function sendMessage(e) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    if (!supabase) { setMessages(prev => [...prev, { id: `demo-${Date.now()}`, body, reply: '', created_at: new Date().toISOString() }]); setDraft(''); showToast('미리보기 메시지예요. Supabase 연결 후 실제 저장돼요.'); return; }
    setSending(true);
    const { error } = await supabase.from('mokit_messages').insert({ body });
    if (error) showToast('메시지를 보내지 못했어요. 잠시 후 다시 시도해 주세요.');
    else setDraft('');
    setSending(false);
  }

  async function login(e) {
    e.preventDefault();
    setLoginError('');
    if (!supabase) { setLoginError('Supabase 환경 변수를 먼저 설정해 주세요.'); return; }
    const { error } = await supabase.auth.signInWithPassword({ email: 'mokit_wav@naver.com', password });
    if (error) setLoginError('로그인 정보를 확인해 주세요.');
    else { setShowLogin(false); setShowSettings(true); setPassword(''); }
  }

  async function saveProfile(e) {
   async function uploadProfileImage(file, kind) {
  if (!file || !supabase || !admin) return;

  if (!file.type.startsWith('image/')) {
    showToast('이미지 파일만 선택할 수 있어요.');
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    showToast('사진은 5MB 이하로 선택해 주세요.');
    return;
  }

  setUploadingImage(kind);

  const extension =
    (file.name.split('.').pop() || 'jpg')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '') || 'jpg';

  const path =
    `${kind}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

  const { error } = await supabase.storage
    .from('mokit-images')
    .upload(path, file, {
      upsert: false,
      contentType: file.type
    });

  if (error) {
    showToast('사진 업로드에 실패했어요.');
    setUploadingImage('');
    return;
  }

  const { data } = supabase.storage
    .from('mokit-images')
    .getPublicUrl(path);

  const field = kind === 'avatar' ? 'avatar_url' : 'cover_url';

  setSettings(prev => ({
    ...prev,
    [field]: data.publicUrl
  }));

  setUploadingImage('');

  showToast('사진을 선택했어요! 변경 사항 저장을 눌러 주세요.');
}
    e.preventDefault();
    if (!supabase || !admin) return;
    const patch = {
      nickname: settings.nickname.trim() || '모킷',
      avatar_url: settings.avatar_url.trim(),
      cover_url: settings.cover_url.trim(),
      bio: settings.bio.trim(),
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from('mokit_profile').update(patch).eq('id', 1);
    if (error) showToast('저장하지 못했어요. 관리자 계정과 SQL 설정을 확인해 주세요.');
    else { setProfile(patch); setShowSettings(false); showToast('프로필이 업데이트됐어요 ✦'); }
  }

  async function deleteMessage(messageId) {
    if (!supabase || !admin) return;
    const confirmed = window.confirm('이 익명 메시지를 삭제할까요? 삭제하면 복구할 수 없어요.');
    if (!confirmed) return;
    const { error } = await supabase.from('mokit_messages').delete().eq('id', messageId);
    if (error) showToast('메시지를 삭제하지 못했어요. SQL 권한 설정을 확인해 주세요.');
    else { setMessages(prev => prev.filter(m => String(m.id) !== String(messageId))); showToast('메시지를 삭제했어요.'); }
  }

  async function saveReply(messageId) {
    const reply = (replyDrafts[messageId] || '').trim();
    if (!supabase || !admin || !reply) return;
    const { error } = await supabase.from('mokit_messages').update({ reply }).eq('id', messageId);
    if (error) showToast('답변을 저장하지 못했어요. SQL 설정을 확인해 주세요.');
    else { setMessages(prev => prev.map(m => String(m.id) === String(messageId) ? { ...m, reply } : m)); setReplyDrafts(prev => ({...prev, [messageId]: ''})); showToast('답변을 남겼어요.'); }
  }

  async function logout() {
    await supabase?.auth.signOut();
    setShowSettings(false);
    showToast('관리자 로그아웃했어요.');
  }

  const avatar = profile.avatar_url;
  return <main className={`app-shell ${screen === 'chat' ? 'is-chat' : 'is-profile'}`} style={profile.cover_url ? { '--page-cover': `url(\"${profile.cover_url}\")` } : {}}> 
    <header className="topbar">
      <button className="wordmark" onClick={() => setScreen('profile')} aria-label="프로필로 이동">mokit<span>✳</span></button>
      <button className="admin-star" title="관리자 로그인" onClick={() => admin ? setShowSettings(true) : setShowLogin(true)}><Star size={15} fill="currentColor" strokeWidth={1.5} /></button>
    </header>

    {screen === 'profile' ? <section className="profile-screen">
      <div className="profile-card">
        <div className="profile-photo-wrap">
          {avatar ? <img className="avatar" src={avatar} alt={`${profile.nickname} 프로필`} onError={e => { e.currentTarget.style.display='none'; }} /> : <div className="avatar avatar-placeholder"><span>mokit</span></div>}
        </div>
        <div className="profile-copy">
          <h1>{profile.nickname || '모킷'}</h1>
          <p>{profile.bio || ''}</p>
        </div>
        <button className="enter-button" onClick={() => setScreen('chat')}>입장하기 <ArrowUpRight size={18}/></button>
        {admin && <button className="edit-chip" onClick={() => setShowSettings(true)}><Settings2 size={14}/> 프로필 편집</button>}
      </div>
    </section> : <section className="chat-screen">
      <div className="chat-heading">
        <button className="back-button" onClick={() => setScreen('profile')} aria-label="프로필로 돌아가기">←</button>
        <h1>모킷모치</h1>
        <span className="chat-count">{messages.length}</span>
      </div>
      <div className="message-area">
        {messages.length === 0 && <div className="empty-state"><p>아직 메시지가 없어요.</p></div>}
        {messages.map((m, i) => <div key={m.id ?? i} className="message-pair">
          <div className="message-row anonymous-row">
            <div className="bubble anonymous-bubble">{m.body}</div>
          </div>
          {m.reply && <div className="message-row owner-row"><div className="bubble owner-bubble">{m.reply}</div></div>}
          {admin && <div className="reply-editor"><textarea value={replyDrafts[m.id] ?? (m.reply || '')} onChange={e => setReplyDrafts(prev => ({...prev, [m.id]: e.target.value}))} maxLength={500} rows={2} placeholder="모킷의 답변" /><div className="admin-message-actions"><button type="button" onClick={() => saveReply(m.id)} disabled={!(replyDrafts[m.id] ?? m.reply ?? '').trim()}>답변 저장</button><button type="button" className="delete-message-button" onClick={() => deleteMessage(m.id)}>메시지 삭제</button></div></div>}
        </div>)}
        <div ref={bottomRef} />
      </div>
      <form className="composer" onSubmit={sendMessage}>
        <div className="composer-field"><textarea value={draft} onChange={e => setDraft(e.target.value)} maxLength={500} rows={2} placeholder="메시지를 남겨 주세요" aria-label="익명 메시지" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e); } }} /><button type="submit" disabled={!draft.trim() || sending} aria-label="메시지 보내기"><Send size={17}/></button></div>
        <div className="composer-foot"><span>익명으로 남겨요</span><span>{draft.length}/500</span></div>
      </form>
    </section>}

    {showLogin && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setShowLogin(false); }}>
      <form className="modal login-modal" onSubmit={login}>
        <button type="button" className="modal-close" onClick={() => setShowLogin(false)}><X size={18}/></button>
        <div className="modal-icon"><Star size={21} fill="currentColor"/></div>
        <div className="modal-kicker">ONLY FOR MOKIT</div><h2>관리자 로그인</h2><p>비밀번호를 입력해 주세요.</p>
        <label>PASSWORD<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="비밀번호를 입력해 주세요" required /></label>
        {loginError && <div className="form-error">{loginError}</div>}
        <button className="modal-submit" type="submit">로그인 <ArrowUpRight size={16}/></button>
      </form>
    </div>}

    {showSettings && admin && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setShowSettings(false); }}>
      <form className="modal settings-modal" onSubmit={saveProfile}>
        <button type="button" className="modal-close" onClick={() => setShowSettings(false)}><X size={18}/></button>
        <div className="modal-kicker">MOKIT</div><h2>프로필 꾸미기</h2><p>사진과 소개를 변경해요.</p>
        <label>닉네임<input value={settings.nickname || ''} onChange={e => setSettings({...settings, nickname:e.target.value})} maxLength={40} placeholder="모킷" /></label>
        <label>프로필 사진 URL<div className="input-with-icon"><ImageIcon size={15}/><input value={settings.avatar_url || ''} onChange={e => setSettings({...settings, avatar_url:e.target.value})} placeholder="이미지 주소" /></div></label>
        <label>배경 사진 URL<div className="input-with-icon"><ImageIcon size={15}/><input value={settings.cover_url || ''} onChange={e => setSettings({...settings, cover_url:e.target.value})} placeholder="이미지 주소" /></div></label>
        <label>한 줄 소개<input value={settings.bio || ''} onChange={e => setSettings({...settings, bio:e.target.value})} maxLength={120} placeholder="익명으로 마음을 놓고 가는 곳" /></label>
        <button className="modal-submit" type="submit">변경 사항 저장 <ArrowUpRight size={16}/></button>
        <button className="logout-button" type="button" onClick={logout}><LogOut size={14}/> 로그아웃</button>
      </form>
    </div>}
    {notice && <div className="toast">{notice}</div>}
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
