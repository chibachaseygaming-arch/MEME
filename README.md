# Department of Extremely Bad Ideas

[Play the game online](https://chibachaseygaming-arch.github.io/MEME/)

To activate the website, open [GitHub Pages settings](https://github.com/chibachaseygaming-arch/MEME/settings/pages), choose **Deploy from a branch**, select **main** and **/(root)**, and click **Save**. GitHub will publish future pushes automatically.

A silly first-person foam-blaster game. Open `index.html` in a desktop browser, then click **Clock In**. All gameplay is local and works without an internet connection; optional web fonts fall back to system fonts.

WASD move, mouse aims, click or Space fires, R reloads, Shift sprints, F rescues nearby civilians, E toggles cursor lock, Escape pauses. Arrow keys also turn and move. Red villains attack with expense reports. Blue civilians should be protected. Clear 22 villains across three waves, defeat the Chief Monday Officer, and rescue civilians for bonus points. Walk over coffee and ammo pickups to replenish supplies.

Built with a canvas raycaster, procedural pixel-art characters, synthesized audio, collision detection, wall occlusion, and a minimap. No dependencies or build step. Requires a keyboard and mouse.

## Work mode

Press Escape and choose **Go to Work · Earn Money**. Navigate the randomly generated 3D office maze to your computer desk. A huge yellow waypoint beam and the radar mark its location. Stand nearby, aim at the computer, and left-click to complete silly office tasks for $25 each. Each payment gives a brief yellow screen flash. Money saves locally in your browser when storage is available. Pause and choose **Return to Shooter** to resume the fight where you left it.

## Desk terminal and breach training

Press F near your desk to open the PC terminal. Complete work tasks, then spend your balance on the Foam Cannon (double damage), HR Body Armor (40% less incoming damage), Spreadsheet Turbo (double task pay), or Breach Boots (longer kick target timers). Purchases persist locally. Start door-kicking practice and click six timed circles to knock the training door down and earn $100; three misses end the attempt. Press F or Escape to stand up.

## Office Update 2.0

- Two 3D weapons: **1** selects the rapid foam blaster; **2** selects the wider, harder-hitting Complaint Shotgun. Hold left mouse to keep firing.
- **Q** fires a civilian-safe foam shockwave, stunning nearby visible enemies for three seconds. Ten-second cooldown.
- Sprint uses stamina. Running villains and armored meeting tanks join the regular lunch thieves. Enemies navigate around walls, telegraph attacks, and show health bars.
- Bonk streaks multiply points, villains pay cash, and mission completion pays $250. Best score and purchases save locally.
- Textured walls, projected floor tiles and ceiling lights, office props, foam particles, impact shake, mission banners, and a clearer HUD.
- **M** highlights the route to your desk on the work radar; **F** still opens doors and enters your PC. The main menu can launch directly into work mode.
- Rookie, Pro, and Chaos breach programs pay $100/$180/$300 with an additional $50 for a perfect run. Breach Boots increase target time.
- Pause menu includes mouse sensitivity, fullscreen, and reduced flashes and shake.

Run gameplay regression checks with `node tests/smoke.cjs`.

Smooth rendering update: the canvas renders at 1280 × 720 with antialiased 3D geometry, high-quality image interpolation, narrower wall ray columns, and finer floor and ceiling samples.
