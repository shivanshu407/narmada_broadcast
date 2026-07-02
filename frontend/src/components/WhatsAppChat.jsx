import { useState, useEffect, useRef } from 'preact/hooks';
import { useStore } from '../stores/store';
import { formatChatDateSeparator, formatChatFullTime, formatChatTime } from '../utils/chatDates';
import Icon from './Icons';

const CHAT_INBOX_REFRESH_MS = 5000;

const MediaMessage = ({ mediaId, type }) => {
    const { fetchMediaUrl } = useStore();
    const [mediaUrl, setMediaUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!mediaId) {
            setLoading(false);
            setError(true);
            return;
        }
        let isMounted = true;
        fetchMediaUrl(mediaId)
            .then(url => {
                if (isMounted) {
                    setMediaUrl(url);
                    setLoading(false);
                }
            })
            .catch(err => {
                console.error('Failed to load media:', err);
                if (isMounted) {
                    setError(true);
                    setLoading(false);
                }
            });
        return () => { isMounted = false; };
    }, [mediaId, fetchMediaUrl]);

    if (loading) return <div style={{ padding: '20px', textAlign: 'center', opacity: 0.5, fontSize: '12px' }}>Loading {type}...</div>;
    if (error) return <div style={{ fontSize: '12px', opacity: 0.6, marginBottom: '4px' }}>{type === 'image' ? '📷' : '🎥'} {type} (failed to load)</div>;

    if (type === 'image') {
        return (
            <a href={mediaUrl} target="_blank" rel="noreferrer" style={{ display: 'block', marginBottom: '4px' }}>
                <img src={mediaUrl} alt="WhatsApp Image" style={{ maxWidth: '100%', maxHeight: '250px', borderRadius: '6px', objectFit: 'contain' }} />
            </a>
        );
    }

    if (type === 'audio') {
        return (
            <div style={{ padding: '6px 0', minWidth: '220px' }}>
                <audio controls src={mediaUrl} style={{ width: '100%' }} />
            </div>
        );
    }

    if (type === 'video') {
        return (
            <div style={{ padding: '6px 0' }}>
                <video controls src={mediaUrl} style={{ maxWidth: '100%', maxHeight: '250px', borderRadius: '6px' }} />
            </div>
        );
    }

    return <div style={{ fontSize: '12px', opacity: 0.6, marginBottom: '4px' }}>📎 {type}</div>;
};

const formatWhatsAppText = (text) => {
    if (!text) return '';
    let html = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    // WhatsApp Markdown (with explicit inline styles to survive CSS resets)
    html = html.replace(/\*([^\*\n]+)\*/g, '<strong style="font-weight: 700;">$1</strong>');
    html = html.replace(/_([^_]+)_/g, '<em style="font-style: italic;">$1</em>');
    html = html.replace(/~([^~]+)~/g, '<del style="text-decoration: line-through;">$1</del>');
    html = html.replace(/```([^`]+)```/g, '<code style="background: rgba(0,0,0,0.05); padding: 2px 4px; border-radius: 4px; font-family: monospace;">$1</code>');

    return html;
};

export default function WhatsAppChat() {
    const {
        conversations, conversationFilterCounts, totalUnread, activeConversation, chatMessages, chatHasMore,
        fetchConversations, fetchChatMessages, fetchOlderMessages, sendChatReply, sendChatTemplate, sendChatMedia,
        markConversationRead, archiveConversation, startNewConversation, updateConversationLabels, updateConversationBotPause,
        resolveHumanHandoff, teachBotFromConversation,
        showToast, fetchWhatsAppTemplates, whatsappTemplates,
        contacts, fetchContacts,
    } = useStore();

    const [loadingOlder, setLoadingOlder] = useState(false);
    const [showLabelPicker, setShowLabelPicker] = useState(false);

    const LABEL_OPTIONS = [
        { value: 'vip', label: 'VIP', color: '#f59e0b', bg: '#fef3c7' },
        { value: 'follow-up', label: 'Follow Up', color: '#3b82f6', bg: '#dbeafe' },
        { value: 'complaint', label: 'Complaint', color: '#ef4444', bg: '#fee2e2' },
        { value: 'new-order', label: 'New Order', color: '#22c55e', bg: '#dcfce7' },
        { value: 'pending-payment', label: 'Pending Payment', color: '#f97316', bg: '#ffedd5' },
        { value: 'resolved', label: 'Resolved', color: '#6b7280', bg: '#f3f4f6' },
    ];

    const getConvLabels = (conv) => {
        if (!conv?.labels) return [];
        if (Array.isArray(conv.labels)) return conv.labels;
        try { return JSON.parse(conv.labels); } catch { return []; }
    };

    const toggleLabel = (labelValue) => {
        const current = getConvLabels(activeConversation);
        const next = current.includes(labelValue)
            ? current.filter(l => l !== labelValue)
            : [...current, labelValue];
        updateConversationLabels(selectedConvId, next);
    };

    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');
    const [selectedConvId, setSelectedConvId] = useState(null);
    const [messageText, setMessageText] = useState('');
    const [sending, setSending] = useState(false);

    // File attachment states
    const [selectedFile, setSelectedFile] = useState(null);
    const [filePreviewUrl, setFilePreviewUrl] = useState(null);
    const fileInputRef = useRef(null);
    const [showTemplatePicker, setShowTemplatePicker] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState('');
    const [templateParams, setTemplateParams] = useState(['', '', '']);
    const messagesEndRef = useRef(null);

    const [mobileShowChat, setMobileShowChat] = useState(false);

    // Voice Recording states
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const timerRef = useRef(null);

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioChunksRef.current = [];

            const options = { mimeType: 'audio/webm' };
            let mediaRecorder;
            try {
                mediaRecorder = new MediaRecorder(stream, options);
            } catch {
                // Fallback for Safari/iOS
                mediaRecorder = new MediaRecorder(stream);
            }

            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.start(250);
            setIsRecording(true);
            setRecordingTime(0);

            timerRef.current = setInterval(() => {
                setRecordingTime(t => t + 1);
            }, 1000);
        } catch (err) {
            console.error('Failed to start recording:', err);
            showToast('Microphone access is required to record voice notes.', 'error');
        }
    };

    const cancelRecording = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
        setIsRecording(false);
        setRecordingTime(0);
        audioChunksRef.current = [];
    };

    const stopAndSendRecording = () => {
        if (!selectedConvId) return;

        if (timerRef.current) clearInterval(timerRef.current);

        if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
            return;
        }

        mediaRecorderRef.current.onstop = async () => {
            try {
                const mimeType = mediaRecorderRef.current.mimeType || 'audio/webm';
                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
                const extension = mimeType.includes('ogg') ? 'ogg' : 'webm';
                const file = new File([audioBlob], `voice_note_${Date.now()}.${extension}`, { type: mimeType });

                setSending(true);
                await sendChatMedia(selectedConvId, file, '');
                showToast('Voice note sent!');
            } catch (err) {
                showToast(err.message || 'Failed to send voice note', 'error');
            } finally {
                setSending(false);
                setIsRecording(false);
                setRecordingTime(0);
                audioChunksRef.current = [];
            }
        };

        mediaRecorderRef.current.stop();
        if (mediaRecorderRef.current.stream) {
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
    };

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    // New Chat modal state
    const [showNewChat, setShowNewChat] = useState(false);
    const [newChatPhone, setNewChatPhone] = useState('');
    const [newChatName, setNewChatName] = useState('');
    const [newChatTemplate, setNewChatTemplate] = useState('');
    const [newChatParams, setNewChatParams] = useState(['', '', '']);
    const [newChatSearch, setNewChatSearch] = useState('');
    const [newChatSending, setNewChatSending] = useState(false);
    const [newChatStep, setNewChatStep] = useState(1);
    const [showResolveHandoffModal, setShowResolveHandoffModal] = useState(false);
    const [showResolveChatModal, setShowResolveChatModal] = useState(false);
    const [showTeachBotModal, setShowTeachBotModal] = useState(false);
    const [teachBotForm, setTeachBotForm] = useState({ question: '', answer: '' });
    const [chatActionBusy, setChatActionBusy] = useState(false);

    // Keep refs in sync so polling always uses latest values
    const selectedConvIdRef = useRef(selectedConvId);
    const searchRef = useRef(search);
    const activeFilterRef = useRef(activeFilter);
    const fetchConversationsRef = useRef(fetchConversations);
    const fetchChatMessagesRef = useRef(fetchChatMessages);
    const isChatRefreshInFlightRef = useRef(false);
    useEffect(() => { selectedConvIdRef.current = selectedConvId; }, [selectedConvId]);
    useEffect(() => { searchRef.current = search; }, [search]);
    useEffect(() => { activeFilterRef.current = activeFilter; }, [activeFilter]);
    useEffect(() => { fetchConversationsRef.current = fetchConversations; }, [fetchConversations]);
    useEffect(() => { fetchChatMessagesRef.current = fetchChatMessages; }, [fetchChatMessages]);

    // Initial load
    useEffect(() => {
        fetchConversations();
        fetchWhatsAppTemplates();
        fetchContacts();
    }, []);

    // Vercel serverless deployments cannot rely on long-lived Socket.IO,
    // so keep a lightweight polling fallback while Chat Inbox is open.
    useEffect(() => {
        let cancelled = false;

        const refreshChatInbox = async () => {
            if (cancelled || document.visibilityState === 'hidden' || isChatRefreshInFlightRef.current) return;
            isChatRefreshInFlightRef.current = true;
            const currentConversationId = selectedConvIdRef.current;

            try {
                await fetchConversationsRef.current(searchRef.current, activeFilterRef.current);
                if (currentConversationId) {
                    await fetchChatMessagesRef.current(currentConversationId);
                }
            } catch (err) {
                console.error('Chat Inbox polling refresh failed:', err);
            } finally {
                isChatRefreshInFlightRef.current = false;
            }
        };

        const timer = setInterval(refreshChatInbox, CHAT_INBOX_REFRESH_MS);
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') refreshChatInbox();
        };

        window.addEventListener('focus', refreshChatInbox);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            cancelled = true;
            clearInterval(timer);
            window.removeEventListener('focus', refreshChatInbox);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => fetchConversations(search, activeFilter), 300);
        return () => clearTimeout(timer);
    }, [search, activeFilter]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    const openConversation = async (convId) => {
        setSelectedConvId(convId);
        setMobileShowChat(true);
        await fetchChatMessages(convId);
        await markConversationRead(convId);
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            showToast('File must be less than 5MB', 'error');
            return;
        }
        setSelectedFile(file);
        setFilePreviewUrl(URL.createObjectURL(file));
    };

    const clearFile = () => {
        setSelectedFile(null);
        if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
        setFilePreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSend = async () => {
        if ((!messageText.trim() && !selectedFile) || !selectedConvId) return;
        setSending(true);
        try {
            if (selectedFile) {
                await sendChatMedia(selectedConvId, selectedFile, messageText.trim());
                clearFile();
            } else {
                await sendChatReply(selectedConvId, messageText.trim());
            }
            setMessageText('');
        } catch (err) {
            if (err.message?.includes('24-hour') || err.message?.includes('window')) {
                showToast('24-hour window expired. Use a template to re-engage.', 'info');
                setShowTemplatePicker(true);
            } else {
                showToast(err.message, 'error');
            }
        }
        setSending(false);
    };

    const handleSendTemplate = async () => {
        if (!selectedTemplate || !selectedConvId) return;
        setSending(true);
        try {
            await sendChatTemplate(selectedConvId, selectedTemplate, templateParams.filter(Boolean));
            setShowTemplatePicker(false);
            setSelectedTemplate('');
            setTemplateParams(['', '', '']);
            showToast('Template sent');
        } catch (err) {
            showToast(err.message, 'error');
        }
        setSending(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const formatTime = formatChatTime;
    const formatFullTime = formatChatFullTime;
    const formatDateSeparator = formatChatDateSeparator;

    const statusIcon = (status) => {
        if (status === 'sent') return '\u2713';
        if (status === 'delivered') return '\u2713\u2713';
        if (status === 'read') return '\u2713\u2713';
        if (status === 'failed') return '\u2717';
        return '\u23F3';
    };

    const approvedTemplates = (whatsappTemplates || []).filter(t => t.status === 'APPROVED');
    const conv = activeConversation;
    const isWindowOpen = conv?.is_window_open;
    const windowMinutes = conv?.window_remaining_minutes || 0;

    // Parse template body JSON for rich display
    const parseTemplateBody = (body) => {
        try {
            const data = JSON.parse(body);
            if (data._type === 'template_rich') return data;
        } catch {}
        return null;
    };

    // Rich template card renderer
    const TemplateCard = ({ data, time, status, direction, errorMessage }) => (
        <div style={{
            display: 'flex',
            justifyContent: direction === 'outbound' ? 'flex-end' : 'flex-start',
            marginBottom: '2px',
        }}>
            <div style={{
                maxWidth: '70%', borderRadius: '8px', overflow: 'hidden',
                background: direction === 'outbound' ? '#dcf8c6' : '#fff',
                boxShadow: '0 1px 1px rgba(0,0,0,0.1)',
                ...(status === 'failed' && { border: '1px solid #ef4444', background: '#fef2f2' }),
            }}>
                {/* Header */}
                {data.header && data.header.format === 'IMAGE' && data.header.url && (
                    <img src={data.header.url} alt="Template header"
                        style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', display: 'block' }}
                        onError={e => { e.target.style.display = 'none'; }}
                    />
                )}
                {data.header && data.header.format === 'VIDEO' && (
                    <div style={{
                        background: '#000', height: '120px', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '28px',
                    }}>
                        {'\uD83C\uDFA5'}
                    </div>
                )}
                {data.header && data.header.format === 'DOCUMENT' && (
                    <div style={{
                        background: '#f0f2f5', padding: '12px', display: 'flex',
                        alignItems: 'center', gap: '8px', fontSize: '13px', color: '#555',
                    }}>
                        {'\uD83D\uDCC4'} Document
                    </div>
                )}
                {data.header && data.header.format === 'TEXT' && data.header.text && (
                    <div style={{ padding: '8px 12px 0', fontWeight: 700, fontSize: '14px' }}>
                        {data.header.text}
                    </div>
                )}

                {/* Body */}
                <div style={{ padding: '8px 12px' }}>
                    <div style={{ fontSize: '10px', opacity: 0.5, marginBottom: '4px', fontStyle: 'italic' }}>Template</div>
                    <div
                        style={{ fontSize: '14px', lineHeight: '1.4', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}
                        dangerouslySetInnerHTML={{ __html: formatWhatsAppText(data.body) }}
                    />

                    {/* Footer */}
                    {data.footer && (
                        <div style={{ fontSize: '12px', opacity: 0.5, marginTop: '6px' }}>{data.footer}</div>
                    )}

                    {/* Timestamp + status */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                        <span style={{ fontSize: '10px', opacity: 0.4 }}>{formatFullTime(time)}</span>
                        {direction === 'outbound' && (
                            <span style={{
                                fontSize: '12px',
                                color: status === 'read' ? '#53bdeb' : status === 'failed' ? '#ef4444' : '#999',
                            }}>
                                {statusIcon(status)}
                            </span>
                        )}
                    </div>
                    {status === 'failed' && errorMessage && (
                        <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px' }}>{errorMessage}</div>
                    )}
                </div>

                {/* Buttons */}
                {data.buttons && data.buttons.length > 0 && (
                    <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                        {data.buttons.map((btn, idx) => (
                            <div key={idx} style={{
                                padding: '8px 12px', textAlign: 'center', fontSize: '13px',
                                fontWeight: 500,
                                color: btn.type === 'PHONE_NUMBER' ? '#25D366' : btn.type === 'URL' ? '#00a5f4' : '#00a5f4',
                                borderTop: idx > 0 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            }}>
                                {btn.type === 'PHONE_NUMBER' && '\u260E\uFE0F'}
                                {btn.type === 'URL' && '\uD83D\uDD17'}
                                {btn.text}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    const filteredNewChatContacts = (contacts || []).filter(c => {
        if (!newChatSearch) return true;
        const q = newChatSearch.toLowerCase();
        return (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q);
    });

    const openNewChatModal = () => {
        setShowNewChat(true);
        setNewChatStep(1);
        setNewChatPhone('');
        setNewChatName('');
        setNewChatTemplate('');
        setNewChatParams(['', '', '']);
        setNewChatSearch('');
        fetchContacts();
    };

    const selectContact = (contact) => {
        setNewChatPhone(contact.phone);
        setNewChatName(contact.name);
        setNewChatStep(2);
    };

    const handleStartNewChat = async () => {
        if (!newChatPhone.trim() || !newChatTemplate) return;
        setNewChatSending(true);
        try {
            const result = await startNewConversation(
                newChatPhone.trim(), newChatName.trim(), newChatTemplate,
                newChatParams.filter(Boolean)
            );
            setShowNewChat(false);
            showToast('Template sent! Conversation started.');
            if (result?.conversationId) {
                await openConversation(result.conversationId);
            }
        } catch (err) {
            showToast(err.message, 'error');
        }
        setNewChatSending(false);
    };

    // ── Quick Replies ──
    const QUICK_REPLIES_KEY = `quick_replies_${localStorage.getItem('tenant_slug') || 'default'}`;
    const loadQuickReplies = () => {
        try { return JSON.parse(localStorage.getItem(QUICK_REPLIES_KEY) || '[]'); } catch { return []; }
    };
    const [quickReplies, setQuickReplies] = useState(loadQuickReplies);
    const [showQuickReplyPopup, setShowQuickReplyPopup] = useState(false);
    const [quickReplyFilter, setQuickReplyFilter] = useState('');
    const [showManageQR, setShowManageQR] = useState(false);
    const [qrForm, setQrForm] = useState({ label: '', text: '' });
    const [editingQR, setEditingQR] = useState(null);

    const saveQuickReplies = (list) => {
        localStorage.setItem(QUICK_REPLIES_KEY, JSON.stringify(list));
        setQuickReplies(list);
    };

    const addQuickReply = () => {
        if (!qrForm.label.trim() || !qrForm.text.trim()) return;
        const newList = editingQR !== null
            ? quickReplies.map((qr, i) => i === editingQR ? { ...qrForm } : qr)
            : [...quickReplies, { label: qrForm.label.trim(), text: qrForm.text.trim() }];
        saveQuickReplies(newList);
        setQrForm({ label: '', text: '' });
        setEditingQR(null);
    };

    const deleteQuickReply = (idx) => {
        saveQuickReplies(quickReplies.filter((_, i) => i !== idx));
    };

    // Seed defaults if empty
    if (quickReplies.length === 0) {
        const defaults = [
            { label: 'Greeting', text: 'Hi! Thank you for reaching out. How can I help you today? 😊' },
            { label: 'Order Status', text: 'Your order has been received and is being processed. We will update you once it ships! 📦' },
            { label: 'Payment Link', text: 'Please complete your payment using the link below. Let me know once done! 🙏' },
            { label: 'Thank You', text: 'Thank you for your order! We appreciate your business. ❤️' },
            { label: 'Out of Stock', text: 'Sorry, this item is currently out of stock. We expect restocking soon. Would you like to be notified?' },
        ];
        saveQuickReplies(defaults);
    }

    const filteredQR = quickReplies.filter(qr =>
        !quickReplyFilter || qr.label.toLowerCase().includes(quickReplyFilter.toLowerCase()) || qr.text.toLowerCase().includes(quickReplyFilter.toLowerCase())
    );

    const handleMessageInput = (e) => {
        const val = e.target.value;
        setMessageText(val);
        // Show quick reply popup when user types /
        if (val === '/' || val.startsWith('/')) {
            setShowQuickReplyPopup(true);
            setQuickReplyFilter(val.slice(1));
        } else {
            setShowQuickReplyPopup(false);
            setQuickReplyFilter('');
        }
    };

    const insertQuickReply = (text) => {
        setMessageText(text);
        setShowQuickReplyPopup(false);
        setQuickReplyFilter('');
    };

    // Bot Pause
    const toggleBotPause = async (convId) => {
        if (!convId) return;
        try {
            await updateConversationBotPause(convId, !isBotPaused);
            showToast(!isBotPaused ? 'Bot paused for this conversation' : 'Bot resumed for this conversation', 'success');
        } catch (err) {
            showToast(err.message || 'Failed to update bot pause', 'error');
        }
    };

    const isBotPaused = Boolean(activeConversation?.bot_paused);
    const isNeedsHuman = Boolean(activeConversation?.needs_human);

    const submitResolveHumanHandoff = async () => {
        if (!selectedConvId) return;
        setChatActionBusy(true);
        try {
            await resolveHumanHandoff(selectedConvId, true);
            setShowResolveHandoffModal(false);
            showToast('Handoff resolved and bot resumed', 'success');
        } catch (err) {
            showToast(err.message || 'Failed to resolve handoff', 'error');
        } finally {
            setChatActionBusy(false);
        }
    };

    const submitResolveSupportChat = async () => {
        if (!selectedConvId) return;
        setChatActionBusy(true);
        try {
            await updateConversationBotPause(selectedConvId, false, true);
            setShowResolveChatModal(false);
            showToast('Support chat resolved and feedback sent', 'success');
        } catch (err) {
            showToast(err.message || 'Failed to resolve chat', 'error');
        } finally {
            setChatActionBusy(false);
        }
    };

    const submitTeachBot = async (e) => {
        e.preventDefault();
        if (!selectedConvId) return;
        const question = teachBotForm.question.trim();
        const answer = teachBotForm.answer.trim();
        if (!question || !answer) {
            showToast('Question and answer are required', 'error');
            return;
        }
        setChatActionBusy(true);
        try {
            await teachBotFromConversation(selectedConvId, question, answer);
            setTeachBotForm({ question: '', answer: '' });
            setShowTeachBotModal(false);
            showToast('Smart FAQ created from this chat', 'success');
        } catch (err) {
            showToast(err.message || 'Failed to teach bot', 'error');
        } finally {
            setChatActionBusy(false);
        }
    };

    const visibleConversations = conversations;
    const filterCounts = {
        all: 0,
        unread: 0,
        open_windows: 0,
        paid: 0,
        unpaid_orders: 0,
        abandoned_carts: 0,
        needs_human: 0,
        ...(conversationFilterCounts || {}),
    };
    const filterOptions = [
        { value: 'all', label: 'All conversations', count: filterCounts.all },
        { value: 'unread', label: 'Unread', count: filterCounts.unread },
        { value: 'paid', label: 'Paid orders', count: filterCounts.paid },
        { value: 'unpaid_orders', label: 'Unpaid orders', count: filterCounts.unpaid_orders },
        { value: 'abandoned_carts', label: 'Abandoned carts', count: filterCounts.abandoned_carts },
        { value: 'needs_human', label: 'Needs human', count: filterCounts.needs_human },
    ];
    const activeFilterOption = filterOptions.find(option => option.value === activeFilter) || filterOptions[0];
    const conversationName = (conversation) => conversation?.display_name || conversation?.contact_name || conversation?.phone || 'Customer';
    const conversationInitial = (conversation) => conversationName(conversation).trim().charAt(0).toUpperCase() || 'C';

    return (
        <div className="page-container chat-inbox-page" style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
            <div className="page-header chat-inbox-header chat-inbox-compact-header" style={{ flexShrink: 0 }}>
                <div className="chat-inbox-heading">
                    <span className="chat-inbox-kicker">Support desk</span>
                    <div className="chat-inbox-title-row">
                        <h1 className="page-title">Chat Inbox</h1>
                        {totalUnread > 0 && <span className="chat-inbox-unread-pill">{totalUnread} unread</span>}
                    </div>
                    <span className="chat-inbox-compact-subtitle">
                        {totalUnread > 0 ? `${totalUnread} unread conversation${totalUnread !== 1 ? 's' : ''}` : 'Reply to WhatsApp conversations'}
                    </span>
                </div>
                <div className="chat-inbox-header-actions" aria-label="Inbox summary">
                    <span><strong>{filterCounts.all}</strong> conversations</span>
                    <span><strong>{filterCounts.open_windows}</strong> open windows</span>
                    <span><strong>{filterCounts.needs_human}</strong> need help</span>
                </div>
            </div>

            <div className="chat-layout chat-inbox-shell" style={{ flex: 1, display: 'flex', gap: '0', border: '1px solid var(--border, #e2e8f0)', borderRadius: '12px', overflow: 'hidden', minHeight: 0 }}>
                {/* Left: Conversation List */}
                <div className={`chat-sidebar chat-list-panel${mobileShowChat ? ' hidden-mobile' : ''}`} style={{ width: '340px', flexShrink: 0, borderRight: '1px solid var(--border, #e2e8f0)', display: 'flex', flexDirection: 'column', background: 'var(--surface, #fff)' }}>
                    {/* Search + New Chat Button */}
                    <div className="chat-list-toolbar">
                        <div className="chat-search-field search-bar" style={{ margin: 0, flex: 1 }}>
                            <Icon name="search" size={16} />
                            <input type="text" value={search} onInput={e => setSearch(e.target.value)}
                                placeholder="Search chats..." className="search-input" style={{ fontSize: '13px' }} />
                        </div>
                        <button
                            className="chat-new-button"
                            onClick={openNewChatModal}
                            title="New Chat"
                        >
                            <Icon name="message-circle" size={18} />
                            <Icon name="plus" size={12} />
                        </button>
                    </div>

                    <div className="chat-filter-control">
                        <label htmlFor="chat-filter-select">Filter</label>
                        <div className="chat-filter-select-wrap">
                            <Icon name="filter" size={15} />
                            <select
                                id="chat-filter-select"
                                className="chat-filter-select"
                                value={activeFilter}
                                onInput={(event) => setActiveFilter(event.currentTarget.value)}
                            >
                                {filterOptions.map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label} ({option.count || 0})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Conversation List */}
                    <div className="chat-conversation-list">
                        {visibleConversations.length === 0 ? (
                            <div className="chat-list-empty">
                                <div className="chat-list-empty__icon">
                                    <Icon name="message-circle" size={34} />
                                </div>
                                <strong>No conversations found</strong>
                                <span>No {activeFilterOption.label.toLowerCase()} right now.</span>
                                <button className="btn btn--success" onClick={openNewChatModal}>
                                    Start new chat
                                </button>
                            </div>
                        ) : visibleConversations.map(c => (
                            <div
                                key={c.id}
                                className={`conversation-card${selectedConvId === c.id ? ' is-active' : ''}${c.unread_count > 0 ? ' has-unread' : ''}`}
                                onClick={() => openConversation(c.id)}
                            >
                                <div className="conversation-avatar" aria-hidden="true">{conversationInitial(c)}</div>
                                <div className="conversation-card__body">
                                    <div className="conversation-card__top">
                                        <div className="conversation-card__name-row">
                                            <span className="conversation-card__name">{conversationName(c)}</span>
                                            {getConvLabels(c).map(lv => {
                                                const opt = LABEL_OPTIONS.find(o => o.value === lv);
                                                if (!opt) return null;
                                                return <span key={lv} className="conversation-label-dot" title={opt.label} style={{ background: opt.color }} />;
                                            })}
                                        </div>
                                        <span className="conversation-card__time">{formatTime(c.last_message_at)}</span>
                                    </div>
                                    <div className="conversation-card__chips">
                                        {c.has_paid_order && (
                                            <span className="conversation-chip is-paid">Paid</span>
                                        )}
                                        {c.has_unpaid_order && (
                                            <span className="conversation-chip is-unpaid">Unpaid</span>
                                        )}
                                        {c.has_abandoned_cart && (
                                            <span className="conversation-chip is-abandoned">Abandoned cart</span>
                                        )}
                                        {c.needs_human && (
                                            <span className="conversation-chip is-human">Needs Human</span>
                                        )}
                                    </div>
                                    <div className="conversation-card__preview-row">
                                        <span className="conversation-card__preview">{c.last_message_text || 'No messages'}</span>
                                        <div className="conversation-card__signals">
                                            {c.is_window_open && (
                                                <span className="conversation-window-dot" title="24h window open" />
                                            )}
                                        {c.unread_count > 0 && (
                                            <span className="conversation-unread-badge">
                                                {c.unread_count}
                                            </span>
                                        )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Chat Area */}
                <div className={`chat-area chat-thread-panel${!mobileShowChat ? ' hidden-mobile' : ''}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f0f2f5' }}>
                    {!selectedConvId ? (
                        <div className="chat-empty-state">
                            <div className="chat-empty-state__icon">
                                <Icon name="message-circle" size={52} />
                            </div>
                            <span>Ready when you are</span>
                            <h2>Select a conversation to start chatting</h2>
                            <p>Customer history, context, labels, quick replies, and handoff controls will appear here.</p>
                            <div className="chat-empty-state__actions">
                                <button className="btn btn--success" onClick={openNewChatModal}>
                                    Start new chat
                                </button>
                                <button className="btn btn--outline" onClick={() => setActiveFilter('needs_human')}>
                                    Review handoffs
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Chat Header */}
                            <div className="chat-thread-header">
                                <div className="chat-thread-person">
                                    <button className="chat-back-btn btn-icon" onClick={() => setMobileShowChat(false)}
                                        style={{ display: 'none' }} title="Back">
                                        <Icon name="arrow-left" size={20} />
                                    </button>
                                    <div className="chat-thread-avatar" aria-hidden="true">{conversationInitial(conv)}</div>
                                    <div>
                                        <div className="chat-thread-name">{conv?.contact_name || conv?.phone}</div>
                                        <div className="chat-thread-subtitle">{conv?.phone}</div>
                                    </div>
                                </div>
                                <div className="chat-thread-actions">
                                    {isWindowOpen ? (
                                        <span className="chat-window-chip is-open">
                                            Window open ({windowMinutes > 60 ? `${Math.floor(windowMinutes / 60)}h ${windowMinutes % 60}m` : `${windowMinutes}m`})
                                        </span>
                                    ) : (
                                        <span className="chat-window-chip is-closed">
                                            Window closed
                                        </span>
                                    )}
                                    <button
                                        className="btn-icon"
                                        onClick={() => {
                                            showToast('Opening WhatsApp to start a call.', 'info');
                                            window.open(`https://wa.me/${conv?.phone?.replace(/\D/g, '')}`, '_blank');
                                        }}
                                        title="WhatsApp Voice Call"
                                        style={{ color: '#64748b' }}
                                    >
                                        <Icon name="phone" size={18} />
                                    </button>
                                    <button
                                        className="btn-icon"
                                        onClick={() => {
                                            showToast('Opening WhatsApp to start a video call.', 'info');
                                            window.open(`https://wa.me/${conv?.phone?.replace(/\D/g, '')}`, '_blank');
                                        }}
                                        title="WhatsApp Video Call"
                                        style={{ color: '#64748b' }}
                                    >
                                        <Icon name="video" size={18} />
                                    </button>
                                    <button
                                        className="btn-icon"
                                        onClick={() => toggleBotPause(selectedConvId)}
                                        title={isBotPaused ? 'Resume Smart Automation' : 'Pause Smart Automation'}
                                        style={{ color: isBotPaused ? '#EF4444' : '#64748b' }}
                                    >
                                        <Icon name={isBotPaused ? 'play' : 'pause'} size={18} />
                                    </button>
                                    {isNeedsHuman && (
                                        <button
                                            className="btn btn--outline"
                                            onClick={() => setShowResolveHandoffModal(true)}
                                            title="Resolve Needs Human"
                                            style={{ fontSize: '12px', padding: '4px 10px', borderColor: '#ef4444', color: '#dc2626', background: '#fef2f2' }}
                                        >
                                            Needs Human
                                        </button>
                                    )}
                                    <button
                                        className="btn-icon"
                                        onClick={() => setShowTeachBotModal(true)}
                                        title="Teach Bot"
                                        style={{ color: '#64748b' }}
                                    >
                                        <Icon name="target" size={18} />
                                    </button>
                                    {isBotPaused && !isNeedsHuman && (
                                        <>
                                            <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '10px', background: '#FEF2F2', color: '#EF4444', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                Bot Paused
                                            </span>
                                            <button
                                                className="btn btn--outline"
                                                onClick={() => setShowResolveChatModal(true)}
                                                style={{
                                                    fontSize: '12px', padding: '4px 10px',
                                                    borderColor: '#10b981', color: '#10b981', background: '#ecfdf5',
                                                    display: 'flex', alignItems: 'center', gap: '4px'
                                                }}
                                                title="Resolve Chat & Send Feedback"
                                            >
                                                <Icon name="check-circle" size={14} /> Resolve Chat
                                            </button>
                                        </>
                                    )}
                                    <button className="btn-icon" onClick={() => setShowManageQR(true)} title="Quick Replies">
                                        <Icon name="zap" size={18} />
                                    </button>
                                    <div style={{ position: 'relative' }}>
                                        <button className="btn-icon" onClick={() => setShowLabelPicker(!showLabelPicker)} title="Labels">
                                            <Icon name="tag" size={18} />
                                        </button>
                                        {showLabelPicker && (
                                            <div style={{
                                                position: 'absolute', top: '100%', right: 0, zIndex: 50,
                                                background: '#fff', border: '1px solid var(--border, #e2e8f0)',
                                                borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                                padding: '8px 0', minWidth: '180px',
                                            }}>
                                                <div style={{ padding: '4px 12px 8px', fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Labels</div>
                                                {LABEL_OPTIONS.map(opt => {
                                                    const isActive = getConvLabels(conv).includes(opt.value);
                                                    return (
                                                        <div key={opt.value} onClick={() => toggleLabel(opt.value)} style={{
                                                            padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                                                            background: isActive ? opt.bg : 'transparent', fontSize: '13px',
                                                        }}
                                                            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f8fafc'; }}
                                                            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                                                        >
                                                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: opt.color, flexShrink: 0 }} />
                                                            <span style={{ flex: 1 }}>{opt.label}</span>
                                                            {isActive && <span style={{ fontSize: '14px' }}>✓</span>}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                    <button className="btn-icon" onClick={() => archiveConversation(selectedConvId)} title="Archive">
                                        <Icon name="archive" size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Label badges */}
                            {getConvLabels(conv).length > 0 && (
                                <div className="chat-label-strip">
                                    {getConvLabels(conv).map(lv => {
                                        const opt = LABEL_OPTIONS.find(o => o.value === lv);
                                        if (!opt) return null;
                                        return (
                                            <span key={lv} className="chat-label-pill" style={{ background: opt.bg, color: opt.color }}>
                                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: opt.color }} />
                                                {opt.label}
                                                <span onClick={() => toggleLabel(lv)} style={{ cursor: 'pointer', marginLeft: '2px', opacity: 0.6 }}>×</span>
                                            </span>
                                        );
                                    })}
                                </div>
                            )}
                            {/* Messages */}
                            <div className="chat-messages">
                                {chatHasMore && (
                                    <div style={{ textAlign: 'center', padding: '8px 0 12px' }}>
                                        <button
                                            onClick={async () => {
                                                setLoadingOlder(true);
                                                await fetchOlderMessages(selectedConvId);
                                                setLoadingOlder(false);
                                            }}
                                            disabled={loadingOlder}
                                            style={{
                                                background: 'transparent', border: '1px solid #cbd5e1',
                                                borderRadius: '16px', padding: '6px 16px', fontSize: '12px',
                                                color: '#64748b', cursor: 'pointer', fontWeight: 500,
                                                transition: 'all 0.15s',
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            {loadingOlder ? '⏳ Loading...' : '↑ Load Older Messages'}
                                        </button>
                                    </div>
                                )}
                                {chatMessages.map((msg, index) => {
                                    const currentDate = formatDateSeparator(msg.created_at);
                                    const prevDate = index > 0 ? formatDateSeparator(chatMessages[index - 1].created_at) : null;
                                    const showDateSeparator = currentDate !== prevDate;

                                    let messageContent = null;

                                    // Check if this is a rich template message
                                    if (msg.message_type === 'template') {
                                        const tplData = parseTemplateBody(msg.body);
                                        if (tplData) {
                                            messageContent = (
                                                <TemplateCard
                                                    data={tplData}
                                                    time={msg.created_at}
                                                    status={msg.status}
                                                    direction={msg.direction}
                                                    errorMessage={msg.error_message}
                                                />
                                            );
                                        }
                                    }

                                    // Default rendering for text, media, and old-format template messages
                                    if (!messageContent) {
                                        messageContent = (
                                        <div className={`chat-message-row ${msg.direction === 'outbound' ? 'is-outbound' : 'is-inbound'}`}>
                                        <div className={`chat-message-bubble${msg.status === 'failed' ? ' is-failed' : ''}`}>
                                            {msg.message_type === 'template' && (
                                                <div style={{ fontSize: '10px', opacity: 0.5, marginBottom: '4px', fontStyle: 'italic' }}>Template</div>
                                            )}
                                            {['image', 'video', 'document', 'audio'].includes(msg.message_type) && msg.media_id ? (
                                                <MediaMessage mediaId={msg.media_id} type={msg.message_type} />
                                            ) : (
                                                <>
                                                    {msg.message_type === 'image' && (
                                                        <div style={{ fontSize: '12px', opacity: 0.6, marginBottom: '4px' }}>{'\uD83D\uDCF7'} Image</div>
                                                    )}
                                                    {msg.message_type === 'video' && (
                                                        <div style={{ fontSize: '12px', opacity: 0.6, marginBottom: '4px' }}>{'\uD83C\uDFA5'} Video</div>
                                                    )}
                                                    {msg.message_type === 'document' && (
                                                        <div style={{ fontSize: '12px', opacity: 0.6, marginBottom: '4px' }}>{'\uD83D\uDCC4'} Document</div>
                                                    )}
                                                    {msg.message_type === 'audio' && (
                                                        <div style={{ fontSize: '12px', opacity: 0.6, marginBottom: '4px' }}>{'\uD83C\uDFB5'} Audio</div>
                                                    )}
                                                </>
                                            )}
                                            {msg.message_type === 'order' && (
                                                <div style={{ padding: '8px', background: 'rgba(37, 211, 102, 0.1)', borderRadius: '8px', marginBottom: '8px', border: '1px solid rgba(37, 211, 102, 0.2)' }}>
                                                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#166534', marginBottom: '4px' }}>🛒 Shopping Cart</div>
                                                    {msg.media_id && (
                                                        <img
                                                            src={msg.media_id}
                                                            alt="Product Thumbnail"
                                                            style={{ width: '100%', maxHeight: '150px', objectFit: 'cover', borderRadius: '4px', marginBottom: '4px' }}
                                                            onError={e => { e.target.style.display = 'none'; }}
                                                        />
                                                    )}
                                                </div>
                                            )}
                                            <div
                                                style={{ fontSize: '14px', lineHeight: '1.4', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}
                                                dangerouslySetInnerHTML={{ __html: formatWhatsAppText(msg.body) }}
                                            />
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                                <span style={{ fontSize: '10px', opacity: 0.4 }}>{formatFullTime(msg.created_at)}</span>
                                                {msg.direction === 'outbound' && (
                                                    <span style={{
                                                        fontSize: '12px',
                                                        color: msg.status === 'read' ? '#53bdeb' : msg.status === 'failed' ? '#ef4444' : '#999',
                                                    }}>
                                                        {statusIcon(msg.status)}
                                                    </span>
                                                )}
                                            </div>
                                            {msg.status === 'failed' && msg.error_message && (
                                                <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px' }}>{msg.error_message}</div>
                                            )}
                                        </div>
                                    </div>
                                        );
                                    }

                                    return (
                                        <div key={msg.id}>
                                            {showDateSeparator && (
                                                <div className="chat-date-separator">
                                                    <span className="chat-date-chip">{currentDate}</span>
                                                </div>
                                            )}
                                            {messageContent}
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Window expired banner */}
                            {!isWindowOpen && (
                                <div style={{
                                    padding: '8px 16px', background: '#fef3c7', borderTop: '1px solid #fcd34d',
                                    fontSize: '13px', color: '#92400e', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                }}>
                                    <span>{'\u26A0\uFE0F'} 24-hour window expired. You can only send templates.</span>
                                    <button className="btn btn--outline" style={{ fontSize: '12px', padding: '4px 10px' }}
                                        onClick={() => setShowTemplatePicker(true)}>
                                        Send Template
                                    </button>
                                </div>
                            )}

                            {/* Quick Reply Popup */}
                            {showQuickReplyPopup && isWindowOpen && (
                                <div style={{
                                    borderTop: '1px solid var(--border, #e2e8f0)',
                                    background: '#fff', maxHeight: '200px', overflowY: 'auto',
                                }}>
                                    <div style={{ padding: '6px 16px', fontSize: '11px', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>⚡ Quick Replies {quickReplyFilter && `— "${quickReplyFilter}"`}</span>
                                        <span style={{ fontSize: '10px', opacity: 0.5 }}>ESC to close</span>
                                    </div>
                                    {filteredQR.length === 0 ? (
                                        <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: '#94a3b8' }}>
                                            No matching quick replies
                                        </div>
                                    ) : filteredQR.map((qr, i) => (
                                        <div key={i} onClick={() => insertQuickReply(qr.text)} style={{
                                            padding: '8px 16px', cursor: 'pointer', borderBottom: '1px solid #f8fafc',
                                            transition: 'background 0.1s',
                                        }}
                                            onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>/{qr.label}</div>
                                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{qr.text}</div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Input Area */}
                            {filePreviewUrl && (
                                <div className="chat-file-preview">
                                    <div style={{ display: 'inline-block', position: 'relative' }}>
                                        <img src={filePreviewUrl} alt="Preview" style={{ maxHeight: '100px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                                        <button onClick={clearFile} style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Icon name="close" size={14} />
                                        </button>
                                    </div>
                                </div>
                            )}
                            <div className="chat-composer">
                                {isRecording ? (
                                    <div className="chat-recording-bar">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                                            <span className="blink-dot" style={{
                                                width: '10px', height: '10px', borderRadius: '50%',
                                                background: '#ef4444', display: 'inline-block'
                                            }} />
                                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#ef4444' }}>Recording Voice Note...</span>
                                            <span style={{ fontSize: '14px', fontFamily: 'monospace', marginLeft: 'auto', color: 'var(--text-secondary)' }}>
                                                {formatDuration(recordingTime)}
                                            </span>
                                        </div>
                                        <button onClick={cancelRecording} className="btn-icon" style={{ color: 'var(--text-secondary)', padding: '6px' }} title="Cancel">
                                            <Icon name="x" size={20} />
                                        </button>
                                        <button onClick={stopAndSendRecording} style={{
                                            width: '32px', height: '32px', borderRadius: '50%',
                                            background: '#25d366', color: '#fff', border: 'none', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }} title="Send Voice Note">
                                            <Icon name="check" size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <button
                                            className="chat-composer-icon"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={!isWindowOpen || sending}
                                            title="Attach file"
                                        >
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                                            </svg>
                                        </button>
                                        <input
                                            type="file"
                                            accept="image/*,application/pdf"
                                            ref={fileInputRef}
                                            onChange={handleFileChange}
                                            style={{ display: 'none' }}
                                        />
                                        <textarea
                                            className="chat-composer-input"
                                            value={messageText}
                                            onInput={handleMessageInput}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Escape') { setShowQuickReplyPopup(false); return; }
                                                handleKeyDown(e);
                                            }}
                                            placeholder={isWindowOpen ? (selectedFile ? "Add a caption..." : "Type / for quick replies...") : "Window expired \u2014 use template"}
                                            disabled={!isWindowOpen || sending}
                                            rows={1}
                                        />

                                        {(!messageText.trim() && !selectedFile) ? (
                                            <button
                                                className="chat-composer-send is-muted"
                                                onClick={startRecording}
                                                disabled={!isWindowOpen || sending}
                                                title="Record Voice Note"
                                            >
                                                <Icon name="mic" size={20} />
                                            </button>
                                        ) : (
                                            <button
                                                className="chat-composer-send"
                                                onClick={handleSend}
                                                disabled={sending || !isWindowOpen}
                                                title="Send Message"
                                            >
                                                <Icon name="send" size={20} />
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Template Picker Modal */}
            {showTemplatePicker && (
                <div className="modal-backdrop" onClick={() => setShowTemplatePicker(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h2>Send Template Message</h2>
                            <button className="btn-icon" onClick={() => setShowTemplatePicker(false)}><Icon name="close" size={20} /></button>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Select Template</label>
                            <select className="form-input" value={selectedTemplate} onChange={e => setSelectedTemplate(e.target.value)}>
                                <option value="">Choose a template</option>
                                {approvedTemplates.map(t => (
                                    <option key={t.name} value={t.name}>{t.name} ({t.language})</option>
                                ))}
                            </select>
                        </div>
                        {selectedTemplate && (
                            <div className="form-group">
                                <label className="form-label">Template Variables (if any)</label>
                                {[0, 1, 2].map(i => (
                                    <input key={i} className="form-input" value={templateParams[i] || ''}
                                        onInput={e => { const p = [...templateParams]; p[i] = e.target.value; setTemplateParams(p); }}
                                        placeholder={`Variable {{${i + 1}}}`} style={{ marginBottom: '8px' }} />
                                ))}
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
                            <button className="btn btn--outline" onClick={() => setShowTemplatePicker(false)}>Cancel</button>
                            <button className="btn btn--success" onClick={handleSendTemplate} disabled={!selectedTemplate || sending}>
                                {sending ? 'Sending...' : 'Send Template'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showResolveHandoffModal && (
                <div className="modal-backdrop" onClick={() => !chatActionBusy && setShowResolveHandoffModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
                        <div className="modal-header">
                            <h2>Resolve Handoff</h2>
                            <button className="btn-icon" onClick={() => setShowResolveHandoffModal(false)} disabled={chatActionBusy}><Icon name="close" size={20} /></button>
                        </div>
                        <div style={{ padding: '16px' }}>
                            <p style={{ margin: 0, color: '#475569', fontSize: '14px', lineHeight: 1.5 }}>
                                Resume the bot for this conversation and send the customer a feedback request.
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px' }}>
                                <button className="btn btn--outline" onClick={() => setShowResolveHandoffModal(false)} disabled={chatActionBusy}>Cancel</button>
                                <button className="btn btn--success" onClick={submitResolveHumanHandoff} disabled={chatActionBusy}>
                                    {chatActionBusy ? 'Resolving...' : 'Resolve'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showResolveChatModal && (
                <div className="modal-backdrop" onClick={() => !chatActionBusy && setShowResolveChatModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
                        <div className="modal-header">
                            <h2>Resolve Support Chat</h2>
                            <button className="btn-icon" onClick={() => setShowResolveChatModal(false)} disabled={chatActionBusy}><Icon name="close" size={20} /></button>
                        </div>
                        <div style={{ padding: '16px' }}>
                            <p style={{ margin: 0, color: '#475569', fontSize: '14px', lineHeight: 1.5 }}>
                                Resume the bot and send a feedback request to the customer.
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px' }}>
                                <button className="btn btn--outline" onClick={() => setShowResolveChatModal(false)} disabled={chatActionBusy}>Cancel</button>
                                <button className="btn btn--success" onClick={submitResolveSupportChat} disabled={chatActionBusy}>
                                    {chatActionBusy ? 'Resolving...' : 'Resolve'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showTeachBotModal && (
                <div className="modal-backdrop" onClick={() => !chatActionBusy && setShowTeachBotModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
                        <form onSubmit={submitTeachBot}>
                            <div className="modal-header">
                                <h2>Teach Bot</h2>
                                <button type="button" className="btn-icon" onClick={() => setShowTeachBotModal(false)} disabled={chatActionBusy}><Icon name="close" size={20} /></button>
                            </div>
                            <div style={{ padding: '16px' }}>
                                <div className="form-group">
                                    <label className="form-label">Customer Question</label>
                                    <textarea
                                        className="form-textarea"
                                        rows={3}
                                        value={teachBotForm.question}
                                        onInput={e => setTeachBotForm(prev => ({ ...prev, question: e.target.value }))}
                                        placeholder="What did the customer ask?"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Bot Answer</label>
                                    <textarea
                                        className="form-textarea"
                                        rows={4}
                                        value={teachBotForm.answer}
                                        onInput={e => setTeachBotForm(prev => ({ ...prev, answer: e.target.value }))}
                                        placeholder="What should the bot reply next time?"
                                        required
                                    />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                    <button type="button" className="btn btn--outline" onClick={() => setShowTeachBotModal(false)} disabled={chatActionBusy}>Cancel</button>
                                    <button type="submit" className="btn btn--success" disabled={chatActionBusy || !teachBotForm.question.trim() || !teachBotForm.answer.trim()}>
                                        {chatActionBusy ? 'Saving...' : 'Create FAQ'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* New Chat Modal */}
            {showNewChat && (
                <div className="modal-backdrop" onClick={() => setShowNewChat(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                        <div className="modal-header">
                            <h2>{newChatStep === 1 ? 'Start New Chat' : 'Select Template'}</h2>
                            <button className="btn-icon" onClick={() => setShowNewChat(false)}><Icon name="close" size={20} /></button>
                        </div>

                        {newChatStep === 1 ? (
                            <>
                                {/* Direct Phone Entry */}
                                <div style={{ padding: '0 0 12px', borderBottom: '1px solid var(--border, #e2e8f0)' }}>
                                    <div className="form-group" style={{ marginBottom: '8px' }}>
                                        <label className="form-label">Enter Phone Number</label>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input
                                                className="form-input"
                                                value={newChatPhone}
                                                onInput={e => setNewChatPhone(e.target.value)}
                                                placeholder="e.g. 919876543210"
                                                style={{ flex: 1 }}
                                            />
                                            <button
                                                className="btn btn--primary"
                                                disabled={!newChatPhone.trim()}
                                                onClick={() => setNewChatStep(2)}
                                                style={{ whiteSpace: 'nowrap' }}
                                            >
                                                Next {'\u2192'}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <input
                                            className="form-input"
                                            value={newChatName}
                                            onInput={e => setNewChatName(e.target.value)}
                                            placeholder="Contact name (optional)"
                                        />
                                    </div>
                                </div>

                                {/* Or Select from Contacts */}
                                <div style={{ padding: '12px 0 8px' }}>
                                    <label className="form-label" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>
                                        Or select from contacts
                                    </label>
                                    <input
                                        className="form-input"
                                        value={newChatSearch}
                                        onInput={e => setNewChatSearch(e.target.value)}
                                        placeholder="Search contacts..."
                                        style={{ marginBottom: '8px' }}
                                    />
                                </div>
                                <div style={{ flex: 1, overflow: 'auto', maxHeight: '300px', border: '1px solid var(--border, #e2e8f0)', borderRadius: '8px' }}>
                                    {filteredNewChatContacts.length === 0 ? (
                                        <div style={{ padding: '20px', textAlign: 'center', opacity: 0.5, fontSize: '13px' }}>No contacts found</div>
                                    ) : filteredNewChatContacts.slice(0, 50).map(c => (
                                        <div
                                            key={c.id}
                                            onClick={() => c.phone && selectContact(c)}
                                            style={{
                                                padding: '10px 14px', cursor: c.phone ? 'pointer' : 'default',
                                                borderBottom: '1px solid #f1f5f9',
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                opacity: c.phone ? 1 : 0.4,
                                                transition: 'background 0.15s',
                                            }}
                                            onMouseEnter={e => { if (c.phone) e.currentTarget.style.background = '#f0fdf4'; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                        >
                                            <div>
                                                <div style={{ fontWeight: 500, fontSize: '14px' }}>{c.name}</div>
                                                <div style={{ fontSize: '12px', opacity: 0.5, fontFamily: 'monospace' }}>{c.phone || 'No phone'}</div>
                                            </div>
                                            {c.phone && (
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#25d366" strokeWidth="2">
                                                    <path d="M5 12h14M12 5l7 7-7 7"/>
                                                </svg>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Step 2: Template Selection */}
                                <div style={{
                                    padding: '8px 12px', background: '#f0fdf4', borderRadius: '8px', marginBottom: '12px',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                }}>
                                    <div>
                                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{newChatName || newChatPhone}</div>
                                        <div style={{ fontSize: '12px', opacity: 0.6, fontFamily: 'monospace' }}>{newChatPhone}</div>
                                    </div>
                                    <button className="btn btn--outline" style={{ fontSize: '12px', padding: '4px 10px' }} onClick={() => setNewChatStep(1)}>
                                        {'\u2190'} Change
                                    </button>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Select Template</label>
                                    <select className="form-input" value={newChatTemplate} onChange={e => setNewChatTemplate(e.target.value)}>
                                        <option value="">Choose an approved template</option>
                                        {approvedTemplates.map(t => (
                                            <option key={t.name} value={t.name}>{t.name} ({t.language})</option>
                                        ))}
                                    </select>
                                </div>

                                {newChatTemplate && (
                                    <div className="form-group">
                                        <label className="form-label">Template Variables (if any)</label>
                                        {[0, 1, 2].map(i => (
                                            <input key={i} className="form-input" value={newChatParams[i] || ''}
                                                onInput={e => { const p = [...newChatParams]; p[i] = e.target.value; setNewChatParams(p); }}
                                                placeholder={`Variable {{${i + 1}}}`} style={{ marginBottom: '8px' }} />
                                        ))}
                                    </div>
                                )}

                                {/* WhatsApp Preview */}
                                {newChatTemplate && (() => {
                                    const tpl = approvedTemplates.find(t => t.name === newChatTemplate);
                                    const bodyComp = tpl?.components?.find(c => c.type === 'BODY');
                                    const bodyText = bodyComp?.text?.replace(/\{\{(\d+)\}\}/g, (_, idx) => newChatParams[parseInt(idx) - 1] || `{{${idx}}}`) || '';
                                    const buttonsComp = tpl?.components?.find(c => c.type === 'BUTTONS');
                                    return (
                                        <div style={{
                                            background: '#e5ddd5', borderRadius: '10px', padding: '14px 12px',
                                            marginBottom: '8px',
                                        }}>
                                            <div style={{
                                                background: '#fff', borderRadius: '0 8px 8px 8px',
                                                padding: '8px 10px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                                maxWidth: '260px',
                                            }}>
                                                <div style={{ fontSize: '13px', color: '#111b21', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>{bodyText}</div>
                                                <div style={{ fontSize: '10px', color: '#8696a0', textAlign: 'right', marginTop: '2px' }}>
                                                    {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                </div>
                                                {buttonsComp?.buttons?.map((btn, idx) => (
                                                    <div key={idx} style={{
                                                        borderTop: '1px solid #e9ecef', padding: '8px 6px',
                                                        textAlign: 'center', fontSize: '13px',
                                                        color: btn.type === 'PHONE_NUMBER' ? '#25D366' : '#00a5f4', fontWeight: 500,
                                                    }}>
                                                        {btn.text}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}

                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                                    <button className="btn btn--outline" onClick={() => setShowNewChat(false)}>Cancel</button>
                                    <button
                                        className="btn btn--success"
                                        onClick={handleStartNewChat}
                                        disabled={!newChatTemplate || newChatSending}
                                    >
                                        {newChatSending ? 'Sending...' : '\uD83D\uDCAC Send & Start Chat'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Manage Quick Replies Modal */}
            {showManageQR && (
                <div className="modal-backdrop" onClick={() => setShowManageQR(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
                        <div className="modal-header">
                            <h2>⚡ Quick Replies</h2>
                            <button className="btn-icon" onClick={() => setShowManageQR(false)}><Icon name="close" size={20} /></button>
                        </div>
                        <div style={{ padding: '16px' }}>
                            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                                Type <strong>/</strong> in the chat input to quickly insert a saved reply. Manage your templates below.
                            </p>

                            {/* Add/Edit Form */}
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                                <input
                                    className="form-input" placeholder="Label (e.g. Greeting)"
                                    value={qrForm.label} onInput={e => setQrForm(p => ({ ...p, label: e.target.value }))}
                                    style={{ flex: '0 0 140px', fontSize: '13px' }}
                                />
                                <input
                                    className="form-input" placeholder="Reply text..."
                                    value={qrForm.text} onInput={e => setQrForm(p => ({ ...p, text: e.target.value }))}
                                    style={{ flex: 1, fontSize: '13px' }}
                                />
                                <button className="btn btn--success" onClick={addQuickReply} style={{ fontSize: '13px', padding: '6px 14px' }}>
                                    {editingQR !== null ? 'Update' : 'Add'}
                                </button>
                                {editingQR !== null && (
                                    <button className="btn btn--outline" onClick={() => { setEditingQR(null); setQrForm({ label: '', text: '' }); }} style={{ fontSize: '13px', padding: '6px 10px' }}>
                                        Cancel
                                    </button>
                                )}
                            </div>

                            {/* List */}
                            <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border, #e2e8f0)', borderRadius: '8px' }}>
                                {quickReplies.length === 0 ? (
                                    <div style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: '#94a3b8' }}>
                                        No quick replies yet. Add one above.
                                    </div>
                                ) : quickReplies.map((qr, i) => (
                                    <div key={i} style={{
                                        padding: '10px 12px', borderBottom: i < quickReplies.length - 1 ? '1px solid #f1f5f9' : 'none',
                                        display: 'flex', alignItems: 'center', gap: '10px',
                                    }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>/{qr.label}</div>
                                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{qr.text}</div>
                                        </div>
                                        <button className="btn-icon" onClick={() => { setEditingQR(i); setQrForm({ label: qr.label, text: qr.text }); }} title="Edit">
                                            <Icon name="edit" size={14} />
                                        </button>
                                        <button className="btn-icon" onClick={() => deleteQuickReply(i)} title="Delete" style={{ color: '#ef4444' }}>
                                            <Icon name="delete" size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
