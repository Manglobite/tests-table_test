export class CameraFocus {
 constructor(camera,homePosition,homeTarget){this.camera=camera;this.homePosition=homePosition.clone();this.homeTarget=homeTarget.clone();this.position=this.homePosition.clone();this.target=this.homeTarget.clone();this.goalPosition=this.position.clone();this.goalTarget=this.target.clone();this.active=null;}
 focus(name,position,target){if(this.active===name){this.home();return}this.active=name;this.goalPosition.copy(position);this.goalTarget.copy(target);}
 home(){this.active=null;this.goalPosition.copy(this.homePosition);this.goalTarget.copy(this.homeTarget);}
 update(dt){const k=1-Math.exp(-4.3*dt);this.position.lerp(this.goalPosition,k);this.target.lerp(this.goalTarget,k);this.camera.position.copy(this.position);this.camera.lookAt(this.target);}
}
