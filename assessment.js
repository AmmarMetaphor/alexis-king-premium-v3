/*
 * Shared client-side logic for the Free Assessment quiz and its three
 * results pages. Static/Cloudflare Pages only — no backend, no API calls.
 *
 * GoHighLevel integration point: this file is where a future connection to
 * GoHighLevel would live — creating/updating the contact, capturing their
 * email/name, storing the four scores below, applying the "assessment" tag
 * plus the matching assessment-low / assessment-mid / assessment-high tag,
 * and triggering the corresponding nurture workflow. No credentials or
 * network requests exist in this prototype; every result below stays in
 * sessionStorage on the visitor's own device.
 */
(function () {
  'use strict';

  var SCALE_WORDS = ['Rarely', 'Occasionally', 'Sometimes', 'Often', 'Consistently'];
  var P_LABELS = { prioritize: 'Prioritize', practice: 'Practice', persistence: 'Persistence' };

  function readAnswers() {
    try { return JSON.parse(sessionStorage.getItem('assessmentAnswers')) || {}; }
    catch (e) { return {}; }
  }
  function saveAnswers(answers) {
    try { sessionStorage.setItem('assessmentAnswers', JSON.stringify(answers)); }
    catch (e) { /* sessionStorage unavailable — quiz still works, just won't survive a refresh */ }
  }
  function sumRange(answers, start, end) {
    var sum = 0;
    for (var i = start; i <= end; i++) sum += Number(answers['q' + i]) || 0;
    return sum;
  }
  function classifyP(score) {
    if (score <= 11) return 'Development Area';
    if (score <= 19) return 'Emerging Strength';
    return 'Established Strength';
  }
  function tierFromTotal(total) {
    if (total <= 34) return 'low';
    if (total <= 55) return 'mid';
    return 'high';
  }
  function pickExtreme(scores, mode) {
    var keys = Object.keys(scores);
    var values = keys.map(function (k) { return scores[k]; });
    var target = mode === 'max' ? Math.max.apply(null, values) : Math.min.apply(null, values);
    return keys.filter(function (k) { return scores[k] === target; });
  }
  function joinPNames(keys) {
    return keys.map(function (k) { return P_LABELS[k]; }).join(' + ');
  }

  var Shared = {
    SCALE_WORDS: SCALE_WORDS, P_LABELS: P_LABELS,
    readAnswers: readAnswers, saveAnswers: saveAnswers, sumRange: sumRange,
    classifyP: classifyP, tierFromTotal: tierFromTotal, pickExtreme: pickExtreme, joinPNames: joinPNames
  };
  window.AssessmentShared = Shared;

  /* ---------------- Assessment lead gate ---------------- */
  var gateForm = document.getElementById('assessment-gate');
  if (gateForm) {
    var nameInput = document.getElementById('gate-name');
    var emailInput = document.getElementById('gate-email');
    var submitBtn = document.getElementById('gate-submit');
    var gateError = document.getElementById('gate-error');

    var gateValid = function () {
      return nameInput.value.trim().length > 0 && emailInput.value.trim().length > 0 && emailInput.checkValidity();
    };
    var showGateError = function (message) {
      gateError.textContent = message;
      gateError.hidden = false;
    };
    var hideGateError = function () {
      gateError.hidden = true;
    };
    var syncButton = function () {
      submitBtn.disabled = !gateValid();
      if (!submitBtn.disabled) hideGateError();
    };

    nameInput.addEventListener('input', syncButton);
    emailInput.addEventListener('input', syncButton);

    gateForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = nameInput.value.trim();
      var email = emailInput.value.trim();
      if (!name) {
        showGateError('Please enter your name.');
        return;
      }
      if (!email || !emailInput.checkValidity()) {
        showGateError('Please enter a valid email address.');
        return;
      }
      hideGateError();

      // GoHighLevel integration point: submit { name, email } to a real
      // endpoint here once one exists, to create/update the contact before
      // they begin the assessment. No credentials or network requests exist
      // in this prototype — the values are kept in sessionStorage only.
      try {
        sessionStorage.setItem('assessmentName', name);
        sessionStorage.setItem('assessmentEmail', email);
      } catch (e2) { /* sessionStorage unavailable — assessment still works, just won't personalize */ }

      location.href = '/assessment/quiz';
    });

    syncButton();
  }

  /* ---------------- Quiz page ---------------- */
  var quizForm = document.getElementById('quiz-form');
  if (quizForm) {
    var steps = Array.prototype.slice.call(quizForm.querySelectorAll('.quiz-step'));
    var answers = readAnswers();

    var applySavedAnswers = function () {
      Object.keys(answers).forEach(function (name) {
        var input = quizForm.querySelector('input[name="' + name + '"][value="' + answers[name] + '"]');
        if (input) input.checked = true;
      });
    };
    var stepInputNames = function (step) {
      var names = {};
      Array.prototype.forEach.call(step.querySelectorAll('input[type="radio"]'), function (i) { names[i.name] = true; });
      return Object.keys(names);
    };
    var stepComplete = function (step) {
      return stepInputNames(step).every(function (n) {
        return quizForm.querySelector('input[name="' + n + '"]:checked');
      });
    };
    var firstIncompleteStepIndex = function () {
      for (var i = 0; i < steps.length; i++) if (!stepComplete(steps[i])) return i;
      return steps.length - 1;
    };
    var updateProgress = function (activeIndex) {
      var indicators = document.querySelectorAll('[data-step-indicator]');
      Array.prototype.forEach.call(indicators, function (el, i) {
        el.classList.toggle('is-active', i === activeIndex);
        el.classList.toggle('is-done', i < activeIndex);
      });
      var fill = document.querySelector('.quiz-progress-fill');
      if (fill) fill.style.width = (((activeIndex + 1) / steps.length) * 100) + '%';
      var status = document.querySelector('[data-progress-status]');
      if (status) status.textContent = 'Step ' + (activeIndex + 1) + ' of ' + steps.length;
    };
    var showStep = function (index) {
      steps.forEach(function (s, i) { s.hidden = i !== index; });
      updateProgress(index);
    };

    quizForm.addEventListener('change', function (e) {
      if (e.target.type !== 'radio') return;
      answers[e.target.name] = e.target.value;
      saveAnswers(answers);
      var step = e.target.closest('.quiz-step');
      var error = step && step.querySelector('.quiz-error');
      if (error && stepComplete(step)) error.hidden = true;
    });

    Array.prototype.forEach.call(quizForm.querySelectorAll('[data-next]'), function (btn) {
      btn.addEventListener('click', function () {
        var index = Number(btn.dataset.next) - 1;
        var step = steps[index];
        var error = step.querySelector('.quiz-error');
        if (!stepComplete(step)) {
          if (error) error.hidden = false;
          return;
        }
        if (error) error.hidden = true;
        showStep(index + 1);
        var progressEl = document.querySelector('.quiz-progress');
        if (progressEl) progressEl.scrollIntoView({ block: 'start' });
      });
    });
    Array.prototype.forEach.call(quizForm.querySelectorAll('[data-back]'), function (btn) {
      btn.addEventListener('click', function () {
        showStep(Number(btn.dataset.back) - 2);
        var progressEl = document.querySelector('.quiz-progress');
        if (progressEl) progressEl.scrollIntoView({ block: 'start' });
      });
    });

    quizForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var lastStep = steps[steps.length - 1];
      var error = lastStep.querySelector('.quiz-error');
      if (!stepComplete(lastStep)) {
        if (error) error.hidden = false;
        return;
      }

      var prioritize = sumRange(answers, 1, 5);
      var practice = sumRange(answers, 6, 10);
      var persistence = sumRange(answers, 11, 15);
      var total = prioritize + practice + persistence;

      sessionStorage.setItem('prioritizeScore', String(prioritize));
      sessionStorage.setItem('practiceScore', String(practice));
      sessionStorage.setItem('persistenceScore', String(persistence));
      sessionStorage.setItem('assessmentTotal', String(total));

      // GoHighLevel integration point: send { prioritize, practice, persistence,
      // total, tier } here once a real endpoint exists, alongside the visitor's
      // captured email/name, to create/update their contact and apply tags.

      location.href = '/assessment/results-' + tierFromTotal(total);
    });

    applySavedAnswers();
    showStep(firstIncompleteStepIndex());
  }

  /* ---------------- Results pages ---------------- */
  var resultsRoot = document.querySelector('[data-results-tier]');
  if (resultsRoot) {
    var expectedTier = resultsRoot.getAttribute('data-results-tier');
    var totalRaw = sessionStorage.getItem('assessmentTotal');
    var prioritizeRaw = sessionStorage.getItem('prioritizeScore');
    var practiceRaw = sessionStorage.getItem('practiceScore');
    var persistenceRaw = sessionStorage.getItem('persistenceScore');

    var raws = [totalRaw, prioritizeRaw, practiceRaw, persistenceRaw];
    var hasScores = raws.every(function (v) { return v !== null && v !== '' && !isNaN(Number(v)); });
    var total = Number(totalRaw), prioritize = Number(prioritizeRaw), practice = Number(practiceRaw), persistence = Number(persistenceRaw);
    var actualTier = hasScores ? tierFromTotal(total) : null;
    // Only show real numbers when they were computed for THIS tier. A stale
    // or mismatched sessionStorage result (e.g. visiting a different results
    // URL than the one just computed) falls back to the educational view
    // rather than showing scores that don't belong to this page.
    var isCompleted = hasScores && actualTier === expectedTier;

    var scoresBlock = resultsRoot.querySelector('[data-scores-block]');
    var actionPlanBlock = resultsRoot.querySelector('[data-action-plan-block]');
    var fallbackBlock = resultsRoot.querySelector('[data-fallback-block]');
    if (scoresBlock) scoresBlock.hidden = !isCompleted;
    if (actionPlanBlock) actionPlanBlock.hidden = !isCompleted;
    if (fallbackBlock) fallbackBlock.hidden = isCompleted;

    if (isCompleted) {
      var setBar = function (key, score, max) {
        var bar = resultsRoot.querySelector('[data-score-bar="' + key + '"]');
        if (!bar) return;
        var valueEl = bar.querySelector('[data-score-value]');
        if (valueEl) valueEl.textContent = score + ' / ' + max;
        var fill = bar.querySelector('[data-score-fill]');
        if (fill) requestAnimationFrame(function () { fill.style.width = Math.round((score / max) * 100) + '%'; });
      };
      setBar('total', total, 75);
      setBar('prioritize', prioritize, 25);
      setBar('practice', practice, 25);
      setBar('persistence', persistence, 25);

      var scores = { prioritize: prioritize, practice: practice, persistence: persistence };
      Object.keys(scores).forEach(function (key) {
        var el = resultsRoot.querySelector('[data-p-classification="' + key + '"]');
        if (el) el.textContent = classifyP(scores[key]);
      });

      var strongestKeys = pickExtreme(scores, 'max');
      var weakestKeys = pickExtreme(scores, 'min');
      var allTied = strongestKeys.length === 3;

      var strongestEl = resultsRoot.querySelector('[data-strongest-summary]');
      var weakestEl = resultsRoot.querySelector('[data-development-summary]');
      if (strongestEl) {
        strongestEl.textContent = allTied
          ? 'All three Ps are equally strong right now.'
          : (strongestKeys.length > 1 ? 'Strongest areas: ' : 'Strongest area: ') + joinPNames(strongestKeys);
      }
      if (weakestEl) {
        weakestEl.textContent = allTied
          ? 'All three Ps show room to grow together.'
          : (weakestKeys.length > 1 ? 'Development priorities: ' : 'Development priority: ') + joinPNames(weakestKeys);
      }

      var planStrongest = allTied ? 'All three Ps' : joinPNames(strongestKeys);
      var planWeakest = allTied ? 'All three Ps' : joinPNames(weakestKeys);
      Array.prototype.forEach.call(resultsRoot.querySelectorAll('[data-plan-strongest]'), function (el) { el.textContent = planStrongest; });
      Array.prototype.forEach.call(resultsRoot.querySelectorAll('[data-plan-development]'), function (el) { el.textContent = planWeakest; });
    }
  }

  var planForm = document.querySelector('[data-action-plan-form]');
  if (planForm) {
    planForm.addEventListener('submit', function (e) {
      e.preventDefault();
      // GoHighLevel integration point: once connected, this is where the
      // visitor's email/name would be captured and these four answers
      // attached to their GHL contact record alongside the stored
      // assessment result and tags.
      var data = {};
      new FormData(planForm).forEach(function (v, k) { data[k] = v; });
      try { sessionStorage.setItem('assessmentActionPlan', JSON.stringify(data)); } catch (e2) {}
      var note = planForm.querySelector('[data-plan-status]');
      if (note) note.textContent = 'Saved on this device for this session.';
    });
  }
})();
