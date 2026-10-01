const fs=require('fs');
const url=process.env.SUPABASE_URL||'';
const key=process.env.SUPABASE_ANON_KEY||'';
const esc=s=>JSON.stringify(s);
fs.writeFileSync('src/config.ts', `export const environment = { supabaseUrl: ${esc(url)}, supabaseAnonKey: ${esc(key)} };\n`);
console.log('Generated src/config.ts');
