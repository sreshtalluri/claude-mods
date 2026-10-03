<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <title>session-receipt demo</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      body { margin: 0; background: #1f1e1c; color: #f4f1ea; font-family: system-ui, sans-serif; }
      #root { position: relative; width: 100%; height: 100%; overflow: hidden;
        background: radial-gradient(1200px 800px at 70% 40%, #2a2926 0%, #1f1e1c 70%); }
      .clip { position: absolute; inset: 0; }
      @font-face { font-family: "TermMono"; src: local("SF Mono"), local("SFMono-Regular"), local("Menlo"), local("Consolas"), local("DejaVu Sans Mono"); }
      .mono { font-family: "TermMono", monospace; }

      /* Act 1: the terminal */
      #term { position: absolute; left: 360px; top: 250px; width: 1200px; height: 520px; border-radius: 16px;
        background: #141413; box-shadow: 0 30px 80px rgba(0,0,0,.45); overflow: hidden; }
      #term .bar { height: 46px; background: #232220; display: flex; align-items: center; gap: 10px; padding: 0 18px; }
      #term .dot { width: 14px; height: 14px; border-radius: 50%; background: #3d3b37; }
      #term .name { margin-left: 16px; color: #a19d93; font-size: 20px; }
      #term .body { padding: 30px 36px; font-size: 27px; line-height: 1.75; }
      .dim { color: #948f85; }
      .accent { color: #d97757; }
      .ok { color: #7fb77e; }
      #caret { display: inline-block; width: 15px; height: 30px; background: #f4f1ea; vertical-align: -5px; margin-left: 2px; }
      .ch { opacity: 0; }

      /* Act 2: the printer and its slip */
      #slot { position: absolute; left: 1100px; top: 70px; width: 480px; height: 30px; border-radius: 15px;
        background: #0f0f0e; box-shadow: inset 0 3px 6px rgba(0,0,0,.8), 0 1px 0 #3d3b37; opacity: 0; }
      #dayWrap { position: absolute; left: 1150px; top: 86px; width: 380px; height: 900px; }
      #day { position: absolute; left: 0; top: 0; width: 380px; }
      .slip svg { display: block; width: 100%; height: auto; }
      #buttons { position: absolute; left: 1150px; top: 1000px; display: flex; gap: 14px; opacity: 0; }
      .btn { font-size: 22px; padding: 10px 20px; border-radius: 10px; background: #2d2c29; color: #e9e5dc; border: 1px solid #45433e; }
      #imgBtn { background: #3a3935; }
      #pointer { position: absolute; left: 0; top: 0; width: 34px; height: 46px; opacity: 0; }
      #toast { position: absolute; right: 48px; top: 48px; font-size: 24px; padding: 16px 26px; border-radius: 12px;
        background: #f4f1ea; color: #1f1e1c; box-shadow: 0 16px 40px rgba(0,0,0,.4); opacity: 0; }

      /* Act 3: the hero */
      #week { position: absolute; left: 1420px; top: 130px; width: 400px; opacity: 0; }
      #copy { position: absolute; left: 130px; top: 300px; width: 820px; }
      #title { font-size: 104px; font-weight: 800; letter-spacing: -2px; margin: 0; opacity: 0; }
      #tagline { font-size: 40px; color: #c9c4b8; margin: 18px 0 0; opacity: 0; }
      #install { margin-top: 56px; padding: 26px 32px; border-radius: 14px; background: #141413; border: 1px solid #34322e;
        font-size: 25px; line-height: 1.8; opacity: 0; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-width="1920" data-height="1080" data-duration="12">
      <section id="scene" class="clip" data-start="0" data-duration="12">
        <div id="week" class="slip">{{WEEK_SVG}}</div>

        <div id="term">
          <div class="bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="name mono">claude — ~/trividha</span></div>
          <div class="body mono">
            <div class="dim">&gt; fix the unread badge in the inbox and open a PR</div>
            <div><span class="accent">⏺</span> Updated app/inbox.tsx and api/messages.py</div>
            <div><span class="accent">⏺</span> <span class="ok">Tests pass.</span> Opened PR #42.</div>
            <div>&nbsp;</div>
            <div>&gt; <span class="ch">/</span><span class="ch">r</span><span class="ch">e</span><span class="ch">c</span><span class="ch">e</span><span class="ch">i</span><span class="ch">p</span><span class="ch">t</span><span id="caret"></span></div>
          </div>
        </div>

        <div id="slot"></div>
        <div id="dayWrap"><div id="day" class="slip">{{DAY_SVG}}</div></div>
        <div id="buttons"><span class="btn">Copy text</span><span id="imgBtn" class="btn">Copy image</span></div>
        <div id="toast">Receipt image copied</div>

        <div id="copy">
          <h1 id="title">session-receipt</h1>
          <p id="tagline">A receipt for every Claude Code session.</p>
          <div id="install" class="mono">
            <div><span class="dim">&gt;</span> /plugin marketplace add sreshtalluri/claude-mods</div>
            <div><span class="dim">&gt;</span> /plugin install session-receipt@claude-mods</div>
          </div>
        </div>

        <svg id="pointer" viewBox="0 0 34 46"><path d="M3 2 L3 38 L12 30 L18 44 L24 41 L18 28 L30 28 Z" fill="#fff" stroke="#111" stroke-width="2.5" stroke-linejoin="round"/></svg>
      </section>
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });

      // Act 1: the task finishes, /receipt is typed.
      tl.fromTo("#term", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, 0);
      tl.to(".ch", { opacity: 1, duration: 0.01, stagger: 0.09 }, 0.7);
      tl.fromTo("#caret", { opacity: 1 }, { opacity: 0, duration: 0.3, repeat: 5, yoyo: true, ease: "steps(1)" }, 0.2);

      // Act 2: Enter; the terminal steps aside and the slip feeds out of the slot.
      tl.to("#term", { x: -300, scale: 0.82, opacity: 0.5, duration: 0.7, ease: "power2.inOut" }, 1.9);
      tl.to("#slot", { opacity: 1, duration: 0.4 }, 2.0);
      tl.fromTo("#day", { clipPath: "inset(0% 0% 100% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 2.8, ease: "none" }, 2.3);
      tl.to("#buttons", { opacity: 1, duration: 0.4 }, 5.0);

      // The cursor presses Copy image; the toast says it worked.
      tl.fromTo("#pointer", { x: 900, y: 760, opacity: 0 }, { x: 1345, y: 1015, opacity: 1, duration: 0.8, ease: "power2.inOut" }, 5.1);
      tl.to("#pointer", { scale: 0.85, duration: 0.08, yoyo: true, repeat: 1 }, 5.95);
      tl.set("#imgBtn", { backgroundColor: "#d97757", color: "#141413" }, 5.95);
      tl.fromTo("#toast", { y: -20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: "back.out(2)" }, 6.1);

      // Act 3: everything else clears; the slips settle into the hero.
      tl.to(["#term", "#buttons", "#pointer", "#slot", "#toast"], { opacity: 0, duration: 0.5 }, 7.2);
      tl.to("#dayWrap", { x: -120, y: 30, rotation: -3, duration: 1.1, ease: "power3.inOut" }, 7.3);
      tl.fromTo("#week", { x: 520, rotation: 14, opacity: 0 }, { x: 0, rotation: 6, opacity: 1, duration: 1.1, ease: "power3.out" }, 7.6);
      tl.fromTo("#title", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, 8.0);
      tl.fromTo("#tagline", { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, 8.25);
      tl.fromTo("#install", { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, 8.5);

      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
