1. Запускается, но в консоли ошибки - three.module.js:4437 Uncaught TypeError: Cannot read properties of null (reading 'x')
    at Vector3.lerpVectors (three.module.js:4437:15)
    at updateCamera (main.js:1316:19)
    at animate (main.js:1342:3)
lerpVectors	@	three.module.js:4437
updateCamera	@	main.js:1316
animate	@	main.js:1342
requestAnimationFrame		
animate	@	main.js:1336
requestAnimationFrame		
animate	@	main.js:1336
requestAnimationFrame		
animate	@	main.js:1336
requestAnimationFrame		
animate	@	main.js:1336
requestAnimationFrame		
animate	@	main.js:1336
requestAnimationFrame		
animate	@	main.js:1336
requestAnimationFrame		
animate	@	main.js:1336
requestAnimationFrame		
animate	@	main.js:1336
requestAnimationFrame		
animate	@	main.js:1336
requestAnimationFrame		
animate	@	main.js:1336
requestAnimationFrame		
animate	@	main.js:1336
requestAnimationFrame		
animate	@	main.js:1336
requestAnimationFrame		
animate	@	main.js:1336
requestAnimationFrame		
animate	@	main.js:1336
requestAnimationFrame		
animate	@	main.js:1336
requestAnimationFrame		
animate	@	main.js:1336
requestAnimationFrame		
animate	@	main.js:1336
requestAnimationFrame		
animate	@	main.js:1336
requestAnimationFrame		
animate	@	main.js:1336
requestAnimationFrame		
animate	@	main.js:1336
requestAnimationFrame		
animate	@	main.js:1336
requestAnimationFrame		
animate	@	main.js:1336
requestAnimationFrame		
animate	@	main.js:1336
requestAnimationFrame		
animate	@	main.js:1336
requestAnimationFrame		
animate	@	main.js:1336
requestAnimationFrame		
animate	@	main.js:1336
requestAnimationFrame		
animate	@	main.js:1336
requestAnimationFrame		
animate	@	main.js:1336
requestAnimationFrame		
animate	@	main.js:1336
init	@	main.js:93
(anonymous)	@	main.js:1400

2.запустил через make run - make run
Starting Autumn Desk server...
Serving autumn-desk/public at http://0.0.0.0:4173
127.0.0.1 - - [01/Oct/2026 15:36:18] "GET / HTTP/1.1" 200 -
127.0.0.1 - - [01/Oct/2026 15:36:21] "GET / HTTP/1.1" 200 -
127.0.0.1 - - [01/Oct/2026 15:36:21] "GET /styles.css HTTP/1.1" 200 -
127.0.0.1 - - [01/Oct/2026 15:36:21] "GET /main.js HTTP/1.1" 200 -
127.0.0.1 - - [01/Oct/2026 15:36:21] "GET /vendor/three.module.js HTTP/1.1" 200 -
127.0.0.1 - - [01/Oct/2026 15:36:21] "GET /favicon.ico HTTP/1.1" 404 -
127.0.0.1 - - [01/Oct/2026 15:36:24] "GET /styles.css HTTP/1.1" 200 -
127.0.0.1 - - [01/Oct/2026 15:36:28] "GET / HTTP/1.1" 200 -
127.0.0.1 - - [01/Oct/2026 15:36:28] "GET /styles.css HTTP/1.1" 200 -
127.0.0.1 - - [01/Oct/2026 15:36:28] "GET /main.js HTTP/1.1" 200 -
127.0.0.1 - - [01/Oct/2026 15:36:28] "GET /vendor/three.module.js HTTP/1.1" 200 -
127.0.0.1 - - [01/Oct/2026 15:36:29] "GET /favicon.ico HTTP/1.1" 404 - 
не могу остановиться через ctrl + c, остановилось только через make stop с другой консоли

3. Нарушил промт - подсмотрел за результами terra