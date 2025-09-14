// ios-settings-minimal.stubs.js
// Non-invasive stubs. Nothing auto-runs. Import and call when you're ready.

/**
 * Mount minimal settings with your own router.
 * @param {Object} opts
 * @param {(key:string)=>void} [opts.onNavigate]  // called when a row is clicked (key: 'api' | 'general' | ...)
 * @param {HTMLElement|string} [opts.root='#ios-settings-minimal'] // container element or selector
 * @param {()=>void} [opts.onBack]                // back button
 * @param {(q:string)=>void} [opts.onSearch]      // search input
 */
export function mountIOSMinimalSettings(opts={}){
  const root = typeof opts.root === 'string' ? document.querySelector(opts.root) : (opts.root || document.querySelector('#ios-settings-minimal'));
  if(!root) return;

  const q = (s)=>root.querySelector(s);
  q('.iosm-back')?.addEventListener('click', ()=>opts.onBack?.());

  // navigation
  root.querySelectorAll('[data-key]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const key = btn.getAttribute('data-key');
      opts.onNavigate?.(key);
    });
  });

  // search
  q('#iosm-search')?.addEventListener('input', (e)=>opts.onSearch?.(e.target.value));

  // helper APIs for later (you can call from outside since we return them)
  const api = {
    setProfile({name, sub, avatar}={}){
      if(name)  q('#iosm-name').textContent = name;
      if(sub)   q('#iosm-sub').textContent  = sub;
      if(avatar) q('#iosm-avatar').src      = avatar;
    },
    show(){ root.style.display='flex'; },
    hide(){ root.style.display='none'; }
  };
  return api;
}

// Example (commented):
// const ui = mountIOSMinimalSettings({
//   onNavigate:(k)=>console.log('goto', k),
//   onBack:()=>console.log('back')
// });
// ui?.setProfile({name:'右右', sub:'晖城', avatar:'/img/u.png'});
// ui?.show();

