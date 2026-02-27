;; Swarm Mind — Phase State Machine
;;
;; Content-addressed Wasm module that determines the current cycle phase
;; from the wall-clock Unix timestamp (milliseconds). Every agent that
;; loads this exact binary and calls computePhase(Date.now(), ...) will
;; derive the same phase at the same moment — no coordinator required.
;;
;; Phase layout within each cycle (all durations in ms):
;;   [0,         exploreMs)                          → 0 = explore
;;   [exploreMs, exploreMs+commitMs)                 → 1 = commit
;;   [exploreMs+commitMs, …+revealMs)               → 2 = reveal
;;   [exploreMs+commitMs+revealMs, totalMs)          → 3 = synthesis
;;
;; Exports:
;;   computePhase(nowMs, exploreMs, commitMs, revealMs, synthMs) → i32 (0–3)
;;   cycleNumber (nowMs, exploreMs, commitMs, revealMs, synthMs) → i64
;;   phaseElapsedMs(nowMs, exploreMs, commitMs, revealMs, synthMs) → i64
;;   phaseRemainingMs(nowMs, exploreMs, commitMs, revealMs, synthMs) → i64

(module

  ;; ── internal: total cycle duration ──────────────────────────────────
  (func $total (param $e i64) (param $c i64) (param $r i64) (param $s i64) (result i64)
    (i64.add
      (i64.add (local.get $e) (local.get $c))
      (i64.add (local.get $r) (local.get $s)))
  )

  ;; ── internal: position within current cycle (0 … total-1) ──────────
  (func $pos (param $now i64) (param $e i64) (param $c i64) (param $r i64) (param $s i64) (result i64)
    (i64.rem_u
      (local.get $now)
      (call $total (local.get $e) (local.get $c) (local.get $r) (local.get $s)))
  )

  ;; ── computePhase ─────────────────────────────────────────────────────
  ;; Returns 0=explore, 1=commit, 2=reveal, 3=synthesis
  (func $computePhase (export "computePhase")
    (param $now i64) (param $e i64) (param $c i64) (param $r i64) (param $s i64)
    (result i32)
    (local $p i64)
    (local.set $p (call $pos (local.get $now) (local.get $e) (local.get $c) (local.get $r) (local.get $s)))
    ;; explore?
    (if (i64.lt_u (local.get $p) (local.get $e))
      (then (return (i32.const 0))))
    ;; commit?
    (if (i64.lt_u (local.get $p) (i64.add (local.get $e) (local.get $c)))
      (then (return (i32.const 1))))
    ;; reveal?
    (if (i64.lt_u (local.get $p)
          (i64.add (i64.add (local.get $e) (local.get $c)) (local.get $r)))
      (then (return (i32.const 2))))
    ;; synthesis
    (i32.const 3)
  )

  ;; ── cycleNumber ───────────────────────────────────────────────────────
  ;; Returns how many complete cycles have elapsed since Unix epoch
  (func $cycleNumber (export "cycleNumber")
    (param $now i64) (param $e i64) (param $c i64) (param $r i64) (param $s i64)
    (result i64)
    (i64.div_u
      (local.get $now)
      (call $total (local.get $e) (local.get $c) (local.get $r) (local.get $s)))
  )

  ;; ── phaseElapsedMs ────────────────────────────────────────────────────
  ;; How many ms have elapsed since the current phase started
  (func $phaseElapsedMs (export "phaseElapsedMs")
    (param $now i64) (param $e i64) (param $c i64) (param $r i64) (param $s i64)
    (result i64)
    (local $p i64)
    (local.set $p (call $pos (local.get $now) (local.get $e) (local.get $c) (local.get $r) (local.get $s)))
    ;; explore
    (if (i64.lt_u (local.get $p) (local.get $e))
      (then (return (local.get $p))))
    ;; commit
    (if (i64.lt_u (local.get $p) (i64.add (local.get $e) (local.get $c)))
      (then (return (i64.sub (local.get $p) (local.get $e)))))
    ;; reveal
    (if (i64.lt_u (local.get $p)
          (i64.add (i64.add (local.get $e) (local.get $c)) (local.get $r)))
      (then (return (i64.sub (local.get $p) (i64.add (local.get $e) (local.get $c))))))
    ;; synthesis
    (i64.sub (local.get $p) (i64.add (i64.add (local.get $e) (local.get $c)) (local.get $r)))
  )

  ;; ── phaseRemainingMs ──────────────────────────────────────────────────
  ;; How many ms remain in the current phase
  (func $phaseRemainingMs (export "phaseRemainingMs")
    (param $now i64) (param $e i64) (param $c i64) (param $r i64) (param $s i64)
    (result i64)
    (local $p i64)
    (local.set $p (call $pos (local.get $now) (local.get $e) (local.get $c) (local.get $r) (local.get $s)))
    ;; explore
    (if (i64.lt_u (local.get $p) (local.get $e))
      (then (return (i64.sub (local.get $e) (local.get $p)))))
    ;; commit
    (if (i64.lt_u (local.get $p) (i64.add (local.get $e) (local.get $c)))
      (then (return (i64.sub (i64.add (local.get $e) (local.get $c)) (local.get $p)))))
    ;; reveal
    (if (i64.lt_u (local.get $p)
          (i64.add (i64.add (local.get $e) (local.get $c)) (local.get $r)))
      (then (return
        (i64.sub
          (i64.add (i64.add (local.get $e) (local.get $c)) (local.get $r))
          (local.get $p)))))
    ;; synthesis
    (i64.sub
      (call $total (local.get $e) (local.get $c) (local.get $r) (local.get $s))
      (local.get $p))
  )

)
