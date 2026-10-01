import 'zone.js';
import {bootstrapApplication} from '@angular/platform-browser';
import {Component, ChangeDetectorRef, NgZone, OnInit, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {createClient, SupabaseClient} from '@supabase/supabase-js';
import {environment} from './config';

type Status='TODO'|'IN_PROGRESS'|'DONE';

@Component({
 selector:'app-root', standalone:true, imports:[CommonModule,FormsModule],
 template:`
<div class="app">
<header>
 <div><div class="brand">◆ Team Jira</div><div class="sub">Shared team board • live updates</div></div>
 <button class="primary" type="button" (click)="openNew()">+ Create task</button>
</header>
<section class="toolbar">
 <input [(ngModel)]="search" placeholder="Search tasks...">
 <select [(ngModel)]="assigneeFilter"><option value="">All members</option><option *ngFor="let u of users" [value]="u.id">{{u.name}}</option></select>
 <select [(ngModel)]="priorityFilter"><option value="">All priorities</option><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select>
 <span class="live">● Live</span>
</section>
<div class="loading" *ngIf="loading">Loading tasks…</div>
<main class="board" [class.is-loading]="loading">
 <section class="column" *ngFor="let col of columns">
  <div class="colhead"><span>{{col.label}}</span><b>{{filtered(col.status).length}}</b></div>
  <div class="dropzone" (dragover)="$event.preventDefault()" (drop)="drop($event,col.status)">
   <article class="card" *ngFor="let t of filtered(col.status)" draggable="true" (dragstart)="dragged=t">
    <div class="key">{{t.task_key}} <span [class]="'priority '+t.priority.toLowerCase()">{{t.priority}}</span></div>
    <h3>{{t.title}}</h3><p>{{t.description}}</p>
    <div class="meta"><span>{{t.user?.name||'Unassigned'}}</span><span>{{t.due_date||''}}</span></div>
    <div class="actions"><button type="button" (click)="edit(t)">Edit</button><button type="button" class="danger" (click)="remove(t)">Delete</button></div>
   </article>
   <div class="empty" *ngIf="filtered(col.status).length===0">Drop tasks here</div>
  </div>
 </section>
</main>
</div>

<div class="modal" *ngIf="editing" (click)="closeOnBackdrop($event)">
 <div class="dialog" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
  <div class="dialog-header"><div><div class="dialog-title">{{editing.id?'Edit task':'Create task'}}</div><div class="dialog-sub">{{editing.id ? editing.task_key : 'Add a task to the shared board'}}</div></div><button type="button" class="close" (click)="cancelEdit()">×</button></div>
  <div class="dialog-body">
   <label>Title<input [(ngModel)]="editing.title" placeholder="What needs to be done?" autofocus><span class="field-error" *ngIf="showTitleError">Please enter a task title.</span></label>
   <label>Description<textarea [(ngModel)]="editing.description" placeholder="Optional details"></textarea></label>
   <div class="row">
    <label>Assignee<select [(ngModel)]="editing.assignee_id"><option [ngValue]="null">Unassigned</option><option *ngFor="let u of users" [ngValue]="u.id">{{u.name}}</option></select></label>
    <label>Priority<select [(ngModel)]="editing.priority"><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></label>
   </div>
   <label>Due date<input type="date" [(ngModel)]="editing.due_date"></label>
  </div>
  <div class="buttons">
   <button type="button" (click)="cancelEdit()" [disabled]="saving">Cancel</button>
   <button type="button" class="primary save-btn" (click)="save()" [disabled]="saving">{{saving?'Saving…':'Save task'}}</button>
  </div>
 </div>
</div>
`
})
export class App implements OnInit {
 private db:SupabaseClient;
 private cdr=inject(ChangeDetectorRef);
 private zone=inject(NgZone);
 tasks:any[]=[]; users:any[]=[]; search=''; assigneeFilter=''; priorityFilter=''; dragged:any=null; editing:any=null;
 loading=true; saving=false; showTitleError=false;
 columns=[{status:'TODO' as Status,label:'To Do'},{status:'IN_PROGRESS' as Status,label:'In Progress'},{status:'DONE' as Status,label:'Done'}];

 constructor(){this.db=createClient(environment.supabaseUrl,environment.supabaseAnonKey);}

 async ngOnInit(){
   if(!environment.supabaseUrl || !environment.supabaseAnonKey){this.loading=false; alert('Configure Supabase environment variables before using the app.'); return;}
   await this.loadAll();
   this.db.channel('team-tasks-live')
     .on('postgres_changes',{event:'*',schema:'public',table:'tasks'},()=>this.zone.run(()=>void this.loadAll(false)))
     .subscribe();
 }

 async loadAll(showLoading=true){
   if(showLoading) this.loading=true;
   try {
     const [usersRes,tasksRes]=await Promise.all([
       this.db.from('users').select('*').order('name'),
       this.db.from('tasks').select('*').order('created_at',{ascending:false})
     ]);
     if(usersRes.error) throw usersRes.error;
     if(tasksRes.error) throw tasksRes.error;
     this.users=usersRes.data||[];
     const byId=new Map(this.users.map(u=>[String(u.id),u]));
     this.tasks=(tasksRes.data||[]).map(t=>({...t,user:byId.get(String(t.assignee_id))||null}));
   } catch(err){
     console.error('Team Jira load failed:',err);
   } finally {
     this.loading=false;
     this.cdr.detectChanges();
   }
 }

 filtered(s:Status){
   const q=this.search.trim().toLowerCase();
   return this.tasks.filter(t=>t.status===s&&(!q||(`${t.task_key} ${t.title} ${t.description||''}`).toLowerCase().includes(q))&&(!this.assigneeFilter||String(t.assignee_id)===this.assigneeFilter)&&(!this.priorityFilter||t.priority===this.priorityFilter));
 }
 openNew(){this.showTitleError=false; this.editing={title:'',description:'',priority:'MEDIUM',assignee_id:null,due_date:null};this.cdr.detectChanges();}
 edit(t:any){this.showTitleError=false; this.editing={...t};this.cdr.detectChanges();}
 cancelEdit(){if(!this.saving){this.editing=null;this.cdr.detectChanges();}}
 closeOnBackdrop(e:MouseEvent){if(e.target===e.currentTarget)this.cancelEdit();}

 async save(){
   const e=this.editing;
   if(!e?.title?.trim()){this.showTitleError=true; this.cdr.detectChanges(); return;}
   if(this.saving)return;
   this.saving=true; this.cdr.detectChanges();
   try {
     let result;
     if(e.id){
       result=await this.db.from('tasks').update({title:e.title.trim(),description:e.description||'',priority:e.priority,assignee_id:e.assignee_id||null,due_date:e.due_date||null}).eq('id',e.id);
     } else {
       result=await this.db.from('tasks').insert({task_key:'TASK-'+String(Date.now()).slice(-6),title:e.title.trim(),description:e.description||'',priority:e.priority,status:'TODO',assignee_id:e.assignee_id||null,due_date:e.due_date||null});
     }
     if(result.error) throw result.error;
     this.editing=null;
     await this.loadAll(false);
   } catch(err){console.error('Save task failed:',err); alert('Could not save the task. Check the browser console for details.');}
   finally {this.saving=false;this.cdr.detectChanges();}
 }

 async remove(t:any){
   if(!confirm('Delete '+t.task_key+'?'))return;
   const result=await this.db.from('tasks').delete().eq('id',t.id);
   if(result.error){alert('Could not delete the task.');console.error(result.error);return;}
   await this.loadAll(false);
 }

 async drop(ev:DragEvent,status:Status){
   ev.preventDefault();if(!this.dragged)return;
   const t=this.dragged;this.dragged=null;
   const result=await this.db.from('tasks').update({status}).eq('id',t.id);
   if(result.error){console.error(result.error);await this.loadAll(false);return;}
   await this.loadAll(false);
 }
}
bootstrapApplication(App).catch(err=>console.error(err));
