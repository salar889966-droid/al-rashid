import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight, Bell, CalendarDays, Check, ChevronDown, Clock3, CloudUpload,
  Facebook, FileImage, ImagePlus, Instagram, LayoutDashboard, Menu, MoreHorizontal,
  Plus, Search, Send, Settings, Sparkles, WandSparkles, X
} from "lucide-react";

type MediaItem = { id: string; name: string; type: string; size: string; url: string; publicId: string };
const initialPosts = [
  { id: 1, title: "Laptop accessories spotlight", channel: "Instagram + Facebook", date: "Today · 6:30 PM", status: "Scheduled", color: "blue" },
  { id: 2, title: "POS solutions for retailers", channel: "Facebook", date: "Tomorrow · 1:00 PM", status: "AI draft", color: "violet" },
  { id: 3, title: "Data recovery service", channel: "Instagram + Facebook", date: "Wed · 7:00 PM", status: "Scheduled", color: "amber" }
];

export default function App() {
  const [active, setActive] = useState("Overview");
  const [files, setFiles] = useState<MediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(true);

  async function loadMedia() {
    try {
      const response = await fetch("/api/media");
      if (!response.ok) throw new Error("Media service unavailable");
      const data = await response.json();
      setFiles((data.items || []).map((item: any) => ({ id: item.id, name: item.name, type: item.type === "video" ? "Video" : "Image", size: (item.size / 1024 / 1024).toFixed(1) + " MB", url: item.url, publicId: item.publicId })));
    } catch (error) { setNotice("Could not load Cloudinary media. Check the service connection."); }
    finally { setMediaLoading(false); }
  }

  useEffect(() => { loadMedia(); }, []);
  const posts = initialPosts;
  const [autoPublish, setAutoPublish] = useState(true);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [dragging, setDragging] = useState(false);
  const filteredPosts = useMemo(() => posts.filter(p => p.title.toLowerCase().includes(search.toLowerCase())), [posts, search]);

  async function addFiles(list: FileList | null) {
    if (!list) return;
    const accepted = Array.from(list).filter(file => file.type.startsWith("image/") || file.type.startsWith("video/"));
    if (!accepted.length) { setNotice("Please choose image or video files."); return; }
    for (const file of accepted) {
      const form = new FormData();
      form.append("file", file);
      try {
        const response = await fetch("/api/media/upload", { method: "POST", body: form });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Upload failed");
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Upload failed.");
        return;
      }
    }
    await loadMedia();
    setNotice(`${accepted.length} media file(s) uploaded to Cloudinary and synced with your library.`);
  }

    const nav = [
    { name: "Overview", icon: LayoutDashboard },
    { name: "Media Library", icon: FileImage },
    { name: "AI Studio", icon: WandSparkles },
    { name: "Publishing Calendar", icon: CalendarDays },
    { name: "Settings", icon: Settings }
  ];

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">AR</div><div><strong>Al Rashid</strong><span>MARKETING STUDIO</span></div><button className="icon-button mobile-menu"><Menu size={18}/></button></div>
      <div className="workspace-label">WORKSPACE</div>
      <div className="workspace"><div className="workspace-avatar">AR</div><div><strong>Al Rashid Technologies</strong><small>Business workspace</small></div><ChevronDown size={15}/></div>
      <nav>{nav.map(item => <button key={item.name} className={active === item.name ? "nav-item active" : "nav-item"} onClick={() => setActive(item.name)}><item.icon size={18}/><span>{item.name}</span>{item.name === "Media Library" && files.length > 0 && <em>{files.length}</em>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><Sparkles size={18}/><strong>Your AI assistant</strong><p>Turn product photos into ready-to-publish social content.</p><button onClick={() => setActive("AI Studio")}>Open AI Studio <ArrowUpRight size={14}/></button></div><div className="profile"><div className="profile-avatar">N</div><div><strong>Workspace admin</strong><small>Al Rashid Technologies</small></div><MoreHorizontal size={18}/></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> {active}</div><div className="top-actions"><div className="connection-pill"><i/> Meta accounts not connected</div><button className="icon-button"><Bell size={18}/></button><div className="user-avatar">AR</div></div></header>
      <div className="content">
        <section className="welcome-row"><div><div className="eyebrow">MONDAY, NOVEMBER 23, 2026</div><h1>{active === "Overview" ? "Good morning. Let's grow your brand." : active}</h1><p>Everything you need to create, plan and publish your social content.</p></div><button className="primary-button" onClick={() => setActive("Media Library")}><Plus size={17}/> Create a post</button></section>
        {notice && <div className="notice"><Check size={16}/>{notice}<button onClick={() => setNotice("")}><X size={15}/></button></div>}
        {active === "Overview" && <>
          <div className="stats-grid"><Stat label="Media uploaded" value={String(files.length).padStart(2,"0")} hint="In your library" icon={<ImagePlus/>}/><Stat label="Posts in queue" value={String(posts.filter(p=>p.status==="Scheduled").length).padStart(2,"0")} hint="Ready for publishing" icon={<CalendarDays/>}/><Stat label="Auto-publishing" value={autoPublish ? "ON" : "OFF"} hint="Publishing preference" icon={<Send/>}/><Stat label="Connected channels" value="0 / 2" hint="Facebook · Instagram" icon={<Sparkles/>}/></div>
          <div className="grid-main"><section className="panel upload-panel"><div className="panel-heading"><div><h2>Upload your media</h2><p>Start with a product photo or video. Your AI workflow begins here.</p></div><span className="soft-tag"><Sparkles size={13}/> AI-powered</span></div><label className={dragging ? "dropzone dragging" : "dropzone"} onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);addFiles(e.dataTransfer.files)}}><input type="file" accept="image/*,video/*" multiple onChange={e=>addFiles(e.target.files)}/><div className="upload-icon"><CloudUpload size={25}/></div><strong>Drop your photos and videos here</strong><span>or <b>browse files</b> from your device</span><small>JPG, PNG, WEBP, MP4 and MOV · Multiple files supported</small></label><div className="upload-footer"><span><Check size={14}/> Automatic content workflow</span><span>Images & videos</span></div></section>
          <section className="panel automation-panel"><div className="panel-heading"><div><h2>Automation settings</h2><p>Choose how your content moves to publishing.</p></div><span className="live-dot">● Active</span></div><div className="automation-row"><div className="channel-icon instagram"><Instagram size={19}/></div><div><strong>Instagram</strong><small>Professional account required</small></div><span className="status-chip pending">Not connected</span></div><div className="automation-row"><div className="channel-icon facebook"><Facebook size={19}/></div><div><strong>Facebook Page</strong><small>Page access required</small></div><span className="status-chip pending">Not connected</span></div><div className="toggle-row"><div><strong>Automatic publishing</strong><small>Publish approved-by-rules content automatically</small></div><button className={autoPublish ? "toggle on" : "toggle"} onClick={()=>setAutoPublish(v=>!v)} aria-label="Toggle automatic publishing"><span/></button></div><div className="automation-note"><Clock3 size={15}/> Publishing stays paused until your Meta accounts are connected.</div></section></div>
          <section className="panel posts-panel"><div className="panel-heading"><div><h2>Upcoming content</h2><p>Your scheduled and AI-generated posts.</p></div><button className="text-button" onClick={()=>setActive("Publishing Calendar")}>View calendar <ArrowUpRight size={14}/></button></div><div className="table-toolbar"><div className="search-box"><Search size={15}/><input placeholder="Search posts..." value={search} onChange={e=>setSearch(e.target.value)}/></div><button className="filter-button">All posts <ChevronDown size={14}/></button></div><div className="post-list">{filteredPosts.map(p=><div className="post-row" key={p.id}><div className={`post-thumb ${p.color}`}><ImagePlus size={20}/></div><div className="post-info"><strong>{p.title}</strong><small>{p.channel}</small></div><div className="post-date"><CalendarDays size={14}/>{p.date}</div><span className={p.status==="Scheduled"?"status-chip scheduled":"status-chip draft"}>{p.status}</span><button className="icon-button"><MoreHorizontal size={17}/></button></div>)}{filteredPosts.length===0 && <div className="empty-small">No matching posts.</div>}</div></section>
        </>}
        {active === "Media Library" && <section className="panel"><div className="panel-heading"><div><h2>Your media library</h2><p>Existing Cloudinary assets plus new uploads for your campaigns.</p></div><label className="primary-button upload-compact"><Plus size={16}/> Add media<input type="file" accept="image/*,video/*" multiple onChange={e=>addFiles(e.target.files)}/></label></div><div className="media-grid">{mediaLoading && <div className="empty-state"><CloudUpload size={30}/><strong>Loading Cloudinary assets…</strong></div>}{files.map(f=><div className="media-card" key={f.id}>{f.type === "Video" ? <video src={f.url} controls preload="metadata" /> : <img src={f.url} alt={f.name}/>}<strong>{f.name}</strong><small>{f.type} · {f.size}</small></div>)}{!mediaLoading && files.length===0&&<div className="empty-state"><CloudUpload size={30}/><strong>Your library is ready</strong><span>Upload your first product photo or video.</span></div>}</div></section>}
        {active === "AI Studio" && <section className="panel ai-studio"><div className="ai-orb"><WandSparkles size={30}/></div><h2>Your creative team, powered by AI.</h2><p>Upload media to begin. The AI engine will identify the product, write a campaign caption, create branded artwork and prepare platform-specific posts.</p><div className="ai-steps"><span><Check/> Understand your product</span><span><Check/> Write captions and hashtags</span><span><Check/> Design branded creatives</span><span><Check/> Queue Facebook and Instagram posts</span></div><button className="primary-button" onClick={()=>setActive("Media Library")}><CloudUpload size={17}/> Upload media</button><small className="muted">AI generation will activate after API credentials and storage are configured.</small></section>}
        {active === "Publishing Calendar" && <section className="panel"><div className="panel-heading"><div><h2>Publishing calendar</h2><p>Planned content for your social channels.</p></div><span className="soft-tag"><CalendarDays size={14}/> Weekly view</span></div><div className="calendar-placeholder">{["MON","TUE","WED","THU","FRI","SAT","SUN"].map((d,i)=><div className="calendar-day" key={d}><b>{d}</b><strong>{23+i}</strong>{i===0&&<span>Laptop accessories</span>}{i===1&&<span>POS solutions</span>}{i===2&&<span>Data recovery</span>}</div>)}</div><p className="muted">Calendar entries are sample placeholders until real campaigns are generated.</p></section>}
        {active === "Settings" && <section className="panel settings-panel"><div className="panel-heading"><div><h2>Brand & account settings</h2><p>Set up your brand identity and social channels.</p></div></div><div className="settings-block"><strong>Brand identity</strong><p>Al Rashid Technologies</p><small>IT hardware · Software · Laptop accessories · POS solutions · Data recovery</small></div><div className="settings-block"><strong>Social connections</strong><p>Facebook Page and Instagram Professional account</p><small>Meta OAuth connection and publishing permissions will be configured in the integration phase.</small></div><div className="settings-block"><strong>Publishing mode</strong><p>Automatic publishing {autoPublish?"enabled":"paused"}</p><small>Publishing remains safely blocked until channel connections are verified.</small></div></section>}
        <footer>Al Rashid AI Marketing Studio <span>·</span> Built for smarter everyday marketing</footer>
      </div>
    </main>
  </div>;
}

function Stat({label,value,hint,icon}:{label:string;value:string;hint:string;icon:React.ReactNode}) {
  return <div className="stat-card"><div className="stat-top"><span>{label}</span><div>{icon}</div></div><strong>{value}</strong><small>{hint}</small></div>;
}