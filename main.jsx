import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import {
  Star,
  ArrowUpRight,
  Send,
  X,
  Settings2,
  LogOut,
  Image as ImageIcon,
  Palette
} from 'lucide-react';
import './style.css';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase =
  url && key && !url.includes('YOUR_PROJECT')
    ? createClient(url, key)
    : null;

const ADMIN_EMAIL = 'mokit_wav@naver.com';

const fallbackProfile = {
  nickname: '모킷',
  avatar_url: '',
  cover_url: '',
  bio: '익명으로 마음을 놓고 가는 곳'
};

const themes = [
  { id: 'pink', name: '핑크', color: '#FF5C98' },
  { id: 'blue', name: '블루', color: '#478EE8' },
  { id: 'black', name: '블랙', color: '#454550' },
  { id: 'lavender', name: '라벤더', color: '#9670E8' },
  { id: 'mint', name: '민트', color: '#39B99A' }
];

function App() {
  const [profile, setProfile] = useState(fallbackProfile);
  const [messages, setMessages] = useState([]);
  const [screen, setScreen] = useState('profile');

  const [draft, setDraft] = useState('');
  const [admin, setAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [settings, setSettings] = useState(fallbackProfile);
  const [siteTheme, setSiteTheme] = useState('pink');
  const [sending, setSending] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);
  const [notice, setNotice] = useState('');
  const [replyDrafts, setReplyDrafts] = useState({});
  const [uploadingImage, setUploadingImage] = useState('');

  const bottomRef = useRef(null);
  const avatarFileRef = useRef(null);
  const coverFileRef = useRef(null);
  const noticeTimer = useRef(null);

  useEffect(() => {
    if (!supabase) return;

    let alive = true;

    async function load() {
      const [
        { data: p, error: profileError },
        { data: m, error: messageError },
        { data: s, error: themeError }
      ] = await Promise.all([
        supabase
          .from('mokit_profile')
          .select('*')
          .eq('id', 1)
          .maybeSingle(),

        supabase
          .from('mokit_messages')
          .select('*')
          .order('created_at', { ascending: true })
          .limit(150),

        supabase
          .from('mokit_settings')
          .select('theme')
          .eq('id', 1)
          .maybeSingle()
      ]);

      if (!alive) return;

      if (profileError) console.error(profileError);
      if (messageError) console.error(messageError);
      if (themeError) console.error(themeError);

      if (p) {
        setProfile(p);
        setSettings(p);
      }

      if (m) setMessages(m);

      if (s?.theme && themes.some(t => t.id === s.theme)) {
        setSiteTheme(s.theme);
      }
    }

    load();

    const channel = supabase
      .channel('mokit-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mokit_profile'
        },
        payload => {
          if (!alive || !payload.new) return;

          setProfile(payload.new);
          setSettings(prev => ({ ...prev, ...payload.new }));
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mokit_messages'
        },
        payload => {
          if (!alive) return;

          if (payload.eventType === 'INSERT') {
            setMessages(prev =>
              prev.some(x => String(x.id) === String(payload.new.id))
                ? prev
                : [...prev, payload.new].slice(-150)
            );
          }

          if (payload.eventType === 'UPDATE') {
            setMessages(prev =>
              prev.map(x =>
                String(x.id) === String(payload.new.id)
                  ? payload.new
                  : x
              )
            );
          }

          if (payload.eventType === 'DELETE') {
            setMessages(prev =>
              prev.filter(
                x => String(x.id) !== String(payload.old.id)
              )
            );
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mokit_settings'
        },
        payload => {
          if (!alive) return;

          const updatedTheme = payload.new?.theme;

          if (themes.some(t => t.id === updatedTheme)) {
            setSiteTheme(updatedTheme);
          }
        }
      )
      .subscribe();

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;

      setAdmin(data.session?.user?.email === ADMIN_EMAIL);
    });

    const { data: authListener } =
      supabase.auth.onAuthStateChange((_event, session) => {
        setAdmin(session?.user?.email === ADMIN_EMAIL);
      });

    return () => {
      alive = false;
      supabase.removeChannel(channel);
      authListener.subscription.unsubscribe();

      if (noticeTimer.current) {
        clearTimeout(noticeTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (screen === 'chat') {
      bottomRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'end'
      });
    }
  }, [messages, screen]);

  const showToast = msg => {
    setNotice(msg);

    if (noticeTimer.current) {
      clearTimeout(noticeTimer.current);
    }

    noticeTimer.current = setTimeout(() => {
      setNotice('');
    }, 2600);
  };

  async function sendMessage(e) {
    e.preventDefault();

    const body = draft.trim();

    if (!body || sending) return;

    if (!supabase) {
      setMessages(prev => [
        ...prev,
        {
          id: `demo-${Date.now()}`,
          body,
          sender: admin ? 'mokit' : 'anonymous',
          reply: '',
          created_at: new Date().toISOString()
        }
      ]);

      setDraft('');
      showToast('미리보기 메시지예요. Supabase 연결 후 실제 저장돼요.');
      return;
    }

    setSending(true);

    const payload = admin
      ? { body, sender: 'mokit' }
      : { body };

    const { error } = await supabase
      .from('mokit_messages')
      .insert(payload);

    if (error) {
      console.error('메시지 전송 오류:', error);
      showToast(
        admin
          ? '메시지를 보내지 못했어요. 관리자 권한 설정을 확인해 주세요.'
          : '메시지를 보내지 못했어요. 잠시 후 다시 시도해 주세요.'
      );
    } else {
      setDraft('');
    }

    setSending(false);
  }

  async function login(e) {
    e.preventDefault();
    setLoginError('');

    if (!supabase) {
      setLoginError('Supabase 환경 변수를 먼저 설정해 주세요.');
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password
    });

    if (error || data.user?.email !== ADMIN_EMAIL) {
      setLoginError('로그인 정보를 확인해 주세요.');
      if (!error) await supabase.auth.signOut();
      return;
    }

    setShowLogin(false);
    setShowSettings(true);
    setPassword('');
  }

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

    try {
      const extension =
        (file.name.split('.').pop() || 'jpg')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '') || 'jpg';

      const path =
        `${kind}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}.${extension}`;

      const { error } = await supabase.storage
        .from('mokit-images')
        .upload(path, file, {
          upsert: false,
          contentType: file.type
        });

      if (error) {
        console.error(error);
        showToast('사진 업로드에 실패했어요. Storage 설정을 확인해 주세요.');
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

      showToast('사진을 선택했어요! 변경 사항 저장을 눌러 주세요.');
    } catch (error) {
      console.error(error);
      showToast('사진 업로드 중 오류가 발생했어요.');
    } finally {
      setUploadingImage('');
    }
  }

  async function saveProfile(e) {
  e.preventDefault();

  if (!supabase) {
    showToast('서버에 연결할 수 없어요.');
    return;
  }

  const patch = {
    nickname: settings.nickname.trim() || '모킷',
    avatar_url: (settings.avatar_url || '').trim(),
    cover_url: (settings.cover_url || '').trim(),
    bio: settings.bio.trim(),
    updated_at: new Date().toISOString(),
  };

  console.log('저장할 프로필:', patch);

  const { data, error } = await supabase
    .from('mokit_profile')
    .update(patch)
    .eq('id', 1)
    .select()
    .maybeSingle();

  if (error) {
    console.error('프로필 저장 오류:', error);
    showToast(`저장 실패: ${error.message}`);
    return;
  }

  if (!data) {
    console.error('프로필 저장 대상이 없거나 수정된 행을 확인할 수 없습니다.');
    showToast('프로필을 찾지 못했어요. Supabase 권한을 확인해 주세요.');
    return;
  }

  console.log('DB에 저장된 프로필:', data);

  setProfile(data);
  setSettings(data);
  setShowSettings(false);
  showToast('프로필이 업데이트됐어요 ✦');
}

  async function changeTheme(theme) {
    if (!supabase || !admin || savingTheme) return;

    if (!themes.some(t => t.id === theme)) return;

    const previousTheme = siteTheme;

    setSiteTheme(theme);
    setSavingTheme(true);

    const { error } = await supabase
      .from('mokit_settings')
      .update({
        theme,
        updated_at: new Date().toISOString()
      })
      .eq('id', 1);

    if (error) {
      console.error('테마 저장 오류:', error);
      setSiteTheme(previousTheme);
      showToast('테마를 저장하지 못했어요. 관리자 권한을 확인해 주세요.');
    } else {
      showToast(`${themes.find(t => t.id === theme)?.name} 테마를 적용했어요!`);
    }

    setSavingTheme(false);
  }

  async function deleteMessage(messageId) {
    if (!supabase || !admin) return;

    const confirmed = window.confirm(
      '이 메시지를 삭제할까요? 삭제하면 복구할 수 없어요.'
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from('mokit_messages')
      .delete()
      .eq('id', messageId);

    if (error) {
      showToast('메시지를 삭제하지 못했어요. SQL 권한 설정을 확인해 주세요.');
    } else {
      setMessages(prev =>
        prev.filter(m => String(m.id) !== String(messageId))
      );

      showToast('메시지를 삭제했어요.');
    }
  }

  async function saveReply(messageId) {
    const reply = (replyDrafts[messageId] || '').trim();

    if (!supabase || !admin || !reply) return;

    const { error } = await supabase
      .from('mokit_messages')
      .update({ reply })
      .eq('id', messageId);

    if (error) {
      showToast('답변을 저장하지 못했어요. SQL 권한 설정을 확인해 주세요.');
    } else {
      setMessages(prev =>
        prev.map(m =>
          String(m.id) === String(messageId)
            ? { ...m, reply }
            : m
        )
      );

      setReplyDrafts(prev => ({
        ...prev,
        [messageId]: ''
      }));

      showToast('답변을 남겼어요.');
    }
  }

  async function logout() {
    if (supabase) {
      await supabase.auth.signOut();
    }

    setShowSettings(false);
    showToast('관리자 로그아웃했어요.');
  }

  const avatar = profile.avatar_url;

  return (
    <main
      className={`app-shell theme-${siteTheme} ${
        screen === 'chat' ? 'is-chat' : 'is-profile'
      }`}
      data-theme={siteTheme}
      style={
        profile.cover_url
          ? { '--page-cover': `url("${profile.cover_url}")` }
          : {}
      }
    >
      <header className="topbar">
        <button
          className="wordmark"
          onClick={() => setScreen('profile')}
          aria-label="프로필로 이동"
        >
          mokit<span>✳</span>
        </button>

        <button
          className="admin-star"
          title="관리자 로그인"
          onClick={() => admin ? setShowSettings(true) : setShowLogin(true)}
        >
          <Star size={15} fill="currentColor" strokeWidth={1.5} />
        </button>
      </header>

      {screen === 'profile' ? (
        <section className="profile-screen">
          <div className="profile-card">
            <div className="profile-photo-wrap">
              {avatar ? (
                <img
                  className="avatar"
                  src={avatar}
                  alt={`${profile.nickname} 프로필`}
                  onError={e => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className="avatar avatar-placeholder">
                  <span>mokit</span>
                </div>
              )}
            </div>

            <div className="profile-copy">
              <h1>{profile.nickname || '모킷'}</h1>
              <p>{profile.bio || ''}</p>
            </div>

            <button className="enter-button" onClick={() => setScreen('chat')}>
              입장하기 <ArrowUpRight size={18} />
            </button>

            {admin && (
              <button
                className="edit-chip"
                onClick={() => {
                  setSettings(profile);
                  setShowSettings(true);
                }}
              >
                <Settings2 size={14} />
                프로필 편집
              </button>
            )}
          </div>
        </section>
      ) : (
        <section className="chat-screen">
          <div className="chat-heading">
            <button
              className="back-button"
              onClick={() => setScreen('profile')}
              aria-label="프로필로 돌아가기"
            >
              ←
            </button>

            <h1>모킷모치</h1>
            <span className="chat-count">{messages.length}</span>
          </div>

          <div className="message-area">
            {messages.length === 0 && (
              <div className="empty-state">
                <p>아직 메시지가 없어요.</p>
              </div>
            )}

            {messages.map((m, i) => {
              const isMokit = m.sender === 'mokit';

              return (
                <div key={m.id ?? i} className="message-pair">
                  {isMokit ? (
                    <div className="message-row owner-row">
                      <div className="bubble owner-bubble">
                        {m.body}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="message-row anonymous-row">
                        <div className="bubble anonymous-bubble">
                          {m.body}
                        </div>
                      </div>

                      {m.reply && (
                        <div className="message-row owner-row">
                          <div className="bubble owner-bubble">
                            {m.reply}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {admin && (
                    isMokit ? (
                      <div className="admin-message-actions standalone-actions">
                        <button
                          type="button"
                          className="delete-message-button"
                          onClick={() => deleteMessage(m.id)}
                        >
                          메시지 삭제
                        </button>
                      </div>
                    ) : (
                      <div className="reply-editor">
                        <textarea
                          value={replyDrafts[m.id] ?? (m.reply || '')}
                          onChange={e =>
                            setReplyDrafts(prev => ({
                              ...prev,
                              [m.id]: e.target.value
                            }))
                          }
                          maxLength={500}
                          rows={2}
                          placeholder="모킷의 답변"
                        />

                        <div className="admin-message-actions">
                          <button
                            type="button"
                            onClick={() => saveReply(m.id)}
                            disabled={!(replyDrafts[m.id] ?? m.reply ?? '').trim()}
                          >
                            답변 저장
                          </button>

                          <button
                            type="button"
                            className="delete-message-button"
                            onClick={() => deleteMessage(m.id)}
                          >
                            메시지 삭제
                          </button>
                        </div>
                      </div>
                    )
                  )}
                </div>
              );
            })}

            <div ref={bottomRef} />
          </div>

          <form className={`composer ${admin ? 'admin-composer' : ''}`} onSubmit={sendMessage}>
            <div className="composer-field">
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder={admin ? '모킷의 메시지를 남겨 주세요' : '메시지를 남겨 주세요'}
                aria-label={admin ? '모킷 메시지' : '익명 메시지'}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(e);
                  }
                }}
              />

              <button
                type="submit"
                disabled={!draft.trim() || sending}
                aria-label="메시지 보내기"
              >
                <Send size={17} />
              </button>
            </div>

            <div className="composer-foot">
              <span>{admin ? '모킷으로 메시지 전송' : '익명으로 남겨요'}</span>
              <span>{draft.length}/500</span>
            </div>
          </form>
        </section>
      )}

      {showLogin && (
        <div
          className="modal-backdrop"
          onMouseDown={e => {
            if (e.target === e.currentTarget) setShowLogin(false);
          }}
        >
          <form className="modal login-modal" onSubmit={login}>
            <button type="button" className="modal-close" onClick={() => setShowLogin(false)}>
              <X size={18} />
            </button>

            <div className="modal-icon">
              <Star size={21} fill="currentColor" />
            </div>

            <div className="modal-kicker">ONLY FOR MOKIT</div>
            <h2>관리자 로그인</h2>
            <p>비밀번호를 입력해 주세요.</p>

            <label>
              PASSWORD
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="비밀번호를 입력해 주세요"
                required
              />
            </label>

            {loginError && <div className="form-error">{loginError}</div>}

            <button className="modal-submit" type="submit">
              로그인 <ArrowUpRight size={16} />
            </button>
          </form>
        </div>
      )}

      {showSettings && admin && (
        <div
          className="modal-backdrop"
          onMouseDown={e => {
            if (e.target === e.currentTarget) setShowSettings(false);
          }}
        >
          <form className="modal settings-modal" onSubmit={saveProfile}>
            <button type="button" className="modal-close" onClick={() => setShowSettings(false)}>
              <X size={18} />
            </button>

            <div className="modal-kicker">MOKIT</div>
            <h2>프로필 꾸미기</h2>
            <p>사진과 소개, 사이트 테마를 변경해요.</p>

            <div className="theme-picker">
              <div className="theme-picker-title">
                <Palette size={15} />
                <span>전체 테마</span>
              </div>

              <p className="theme-description">
                선택한 테마는 모든 방문자에게 적용돼요.
              </p>

              <div className="theme-options">
                {themes.map(theme => (
                  <button
                    key={theme.id}
                    type="button"
                    className={`theme-option ${siteTheme === theme.id ? 'selected' : ''}`}
                    onClick={() => changeTheme(theme.id)}
                    disabled={savingTheme}
                    aria-pressed={siteTheme === theme.id}
                  >
                    <span
                      className="theme-swatch"
                      style={{ background: theme.color }}
                    />
                    <span>{theme.name}</span>
                    {siteTheme === theme.id && <span className="theme-check">✓</span>}
                  </button>
                ))}
              </div>

              {savingTheme && <p className="theme-saving">테마 저장 중…</p>}
            </div>

            <label>
              닉네임
              <input
                value={settings.nickname || ''}
                onChange={e => setSettings({ ...settings, nickname: e.target.value })}
                maxLength={40}
                placeholder="모킷"
              />
            </label>

            <label>
              프로필 사진
              <input
                ref={avatarFileRef}
                className="image-file-input"
                type="file"
                accept="image/*"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) uploadProfileImage(file, 'avatar');
                  e.target.value = '';
                }}
              />

              <button
                className="image-pick-button"
                type="button"
                onClick={() => avatarFileRef.current?.click()}
                disabled={uploadingImage !== ''}
              >
                <ImageIcon size={16} />
                {uploadingImage === 'avatar' ? '사진 올리는 중…' : '사진첩에서 선택'}
              </button>

              {settings.avatar_url && (
                <img className="image-preview" src={settings.avatar_url} alt="프로필 사진 미리보기" />
              )}
            </label>

            <label>
              배경 사진
              <input
                ref={coverFileRef}
                className="image-file-input"
                type="file"
                accept="image/*"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) uploadProfileImage(file, 'cover');
                  e.target.value = '';
                }}
              />

              <button
                className="image-pick-button"
                type="button"
                onClick={() => coverFileRef.current?.click()}
                disabled={uploadingImage !== ''}
              >
                <ImageIcon size={16} />
                {uploadingImage === 'cover' ? '사진 올리는 중…' : '사진첩에서 선택'}
              </button>

              {settings.cover_url && (
                <img className="image-preview cover-preview" src={settings.cover_url} alt="배경 사진 미리보기" />
              )}
            </label>

            <label>
              한 줄 소개
              <input
                value={settings.bio || ''}
                onChange={e => setSettings({ ...settings, bio: e.target.value })}
                maxLength={120}
                placeholder="익명으로 마음을 놓고 가는 곳"
              />
            </label>

            <button className="modal-submit" type="submit" disabled={uploadingImage !== ''}>
              {uploadingImage ? '사진 업로드가 끝날 때까지 기다려 주세요' : '프로필 변경 사항 저장'}
              {!uploadingImage && <ArrowUpRight size={16} />}
            </button>

            <button className="logout-button" type="button" onClick={logout}>
              <LogOut size={14} />
              로그아웃
            </button>
          </form>
        </div>
      )}

      {notice && <div className="toast">{notice}</div>}
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
