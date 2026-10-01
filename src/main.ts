import {bootstrapApplication} from '@angular/platform-browser';
import {Component, OnInit, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {createClient, SupabaseClient} from '@supabase/supabase-js';

type Status='TODO'|'IN_PROGRESS'|'DONE';

@Component({
 selector:'app-root', standalone:true, imports:[CommonModule,FormsModule],
 template:`
<div class="app">
<header>
 <div><div class="brand">◆ Team Jira</div><div class="sub">Shared team board • live updates</div></div>
 <button class="primary" (click)="openNew()">+ Create task</button>
</header>
<section class="toolbar">
 <input [(ngModel)]="search" placeholder="Search tasks...">
 <select [(ngModel)]="assigneeFilter"><option value="">All members</option><option *ngFor="let u of users" [value]="u.id">{{u.name}}</option></select>
 <select [(ngModel)]="priorityFilter"><option value="">All priorities</option><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select>
 <span class="live">● Live</span>
</section>
<main class="board">
 <section class="column" *ngFor="let col of columns">
  <div class="colhead"><span>{{col.label}}</span><b>{{filtered(col.status).length}}</b></div>
  <div class="dropzone" (dragover)="$event.preventDefault()" (drop)="drop($event,col.status)">
   <article class="card" *ngFor="let t of filtered(col.status)" draggable="true" (dragstart)="dragged=t">
    <div class="key">{{t.task_key}} <span [class]="'priority '+t.priority.toLowerCase()">{{t.priority}}</span></div>
    <h3>{{t.title}}</h3><p>{{t.description}}</p>
    <div class="meta"><span>{{t.user?.name||'Unassigned'}}</span><span>{{t.due_date||''}}</span></div>
    <div class="actions"><button (click)="edit(t)">Edit</button><button class="danger" (click)="remove(t)">Delete</button></div>
   </article>
   <div class="empty" *ngIf="filtered(col.status).length===0">Drop tasks here</div>
  </div>
 </section>
</main>
</div>

<div class="modal" *ngIf="editing">
 <div class="dialog">
  <h2>{{editing.id?'Edit task':'Create task'}}</h2>
  <label>Title<input [(ngModel)]="editing.title" placeholder="What needs to be done?"></label>
  <label>Description<textarea [(ngModel)]="editing.description"></textarea></label>
  <div class="row">
   <label>Assignee<select [(ngModel)]="editing.assignee_id"><option [ngValue]="null">Unassigned</option><option *ngFor="let u of users" [ngValue]="u.id">{{u.name}}</option></select></label>
   <label>Priority<select [(ngModel)]="editing.priority"><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></label>
  </div>
  <label>Due date<input type="date" [(ngModel)]="editing.due_date"></label>
  <div class="buttons"><button (click)="editing=null">Cancel</button><button class="primary" (click)="save()">Save task</button></div>
 </div>
</div>
`
})
export class App implements OnInit {
 private db:SupabaseClient;
 tasks:any[]=[]; users:any[]=[]; search=''; assigneeFilter=''; priorityFilter=''; dragged:any=null; editing:any=null;
 columns=[{status:'TODO' as Status,label:'To Do'},{status:'IN_PROGRESS' as Status,label:'In Progress'},{status:'DONE' as Status,label:'Done'}];

 constructor(){
   const url=(globalThis as any).__SUPABASE_URL__ || '';
   const key=(globalThis as any).__SUPABASE_ANON_KEY__ || '';
   this.db=createClient(url,key);
 }
 async ngOnInit(){
   if(!(globalThis as any).__SUPABASE_URL__){ alert('Configure Supabase environment variables before using the app.'); return; }
   await this.load();
   const {data}=await this.db.from('users').select('*').order('name');
   this.users=data||[];
   this.db.channel('team-tasks').on('postgres_changes',{event:'*',schema:'public',table:'tasks'},()=>this.load()).subscribe();
 }
 async load(){
   const {data}=await this.db.from('tasks').select('*, user:assignee_id(id,name)').order('created_at',{ascending:false});
   this.tasks=data||[];
 }
 filtered(s:Status){return this.tasks.filter(t=>t.status===s&&(!this.search||(`${t.task_key} ${t.title} ${t.description||''}`).toLowerCase().includes(this.search.toLowerCase()))&&(!this.assigneeFilter||String(t.assignee_id)===this.assigneeFilter)&&(!this.priorityFilter||t.priority===this.priorityFilter));}
 openNew(){this.editing={title:'',description:'',priority:'MEDIUM',assignee_id:null,due_date:null};}
 edit(t:any){this.editing={...t};}
 async save(){
   const e=this.editing;
   if(!e.title?.trim()) return;
   if(e.id) await this.db.from('tasks').update({title:e.title,description:e.description,priority:e.priority,assignee_id:e.assignee_id||null,due_date:e.due_date||null}).eq('id',e.id);
   else {
     const n=this.tasks.length+1;
     await this.db.from('tasks').insert({task_key:'TASK-'+String(Date.now()).slice(-6),title:e.title,description:e.description,priority:e.priority,status:'TODO',assignee_id:e.assignee_id||null,due_date:e.due_date||null});
   }
   this.editing=null; await this.load();
 }
 async remove(t:any){if(confirm('Delete '+t.task_key+'?')){await this.db.from('tasks').delete().eq('id',t.id);await this.load();}}
 async drop(ev:DragEvent,status:Status){ev.preventDefault();if(!this.dragged)return;await this.db.from('tasks').update({status}).eq('id',this.dragged.id);this.dragged=null;await this.load();}
}
bootstrapApplication(App);
