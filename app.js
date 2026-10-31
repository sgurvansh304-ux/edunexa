
/* EduNexa frontend.
   Use only the public Supabase anon/publishable key here.
   NEVER put a service-role key in browser code. */

const CONFIG = {
  supabaseUrl: "https://dzofvkmaugdjqxqhewtz.supabase.co",
  supabaseAnonKey: "sb_publishable_Rnuf0q2FZM2q2iJx-FPMqg_SFCnfbw7",
  turnstileSiteKey: "0x4AAAAAAFrMs-e49jt5HxSF"
};

const configured =
  !CONFIG.supabaseUrl.startsWith("YOUR_") &&
  !CONFIG.supabaseAnonKey.startsWith("YOUR_");

const supabaseClient =
  configured && window.supabase
    ? window.supabase.createClient(
        CONFIG.supabaseUrl,
        CONFIG.supabaseAnonKey
      )
    : null;

let authMode = "signin";
let turnstileToken = "";
let turnstileWidgetId = null;
let activeResources = [];
let editingResourceId = null;
let originalResourceSubmitText = "";

const $ = (id) => document.getElementById(id);

const escapeHTML = (value = "") =>
  String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));

const toast = (message) => {
  const el = $("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  window.setTimeout(() => el.classList.remove("show"), 3200);
};

const setMessage = (id, message, error = false) => {
  const el = $(id);
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("error", error);
};

const setHash = (name) => {
  if (location.hash !== "#" + name) {
    location.hash = name;
  } else {
    renderRoute(name);
  }
};

const titleMap = {
  home: [
    "Choose a learning area",
    "Browse the library and start practising."
  ],
  classes: [
    "Classes 1–12",
    "Choose your class, then browse available subjects and resources."
  ],
  "jee-neet": [
    "JEE & NEET preparation",
    "Find exam-specific worksheets, practice sets and mock tests."
  ],
  worksheets: [
    "Topic-wise worksheets",
    "Practise a topic and review the explanation."
  ],
  "mock-tests": [
    "Mock tests",
    "Start a test, submit your answers and review your score."
  ],
  pyqs: [
    "Previous-year questions",
    "Use verified exam papers and answer keys."
  ],
  account: [
    "Your account",
    "Sign in or create an account to save your progress."
  ]
};

function setActiveNav(route) {
  document.querySelectorAll(".nav a[data-route]").forEach(a => {
    a.classList.toggle("active", a.dataset.route === route);
  });

  $("mainNav").classList.remove("open");
  $("mobileMenu").setAttribute("aria-expanded", "false");
}

function renderRoute(route) {
  if (!titleMap[route]) route = "home";

  setActiveNav(route);

  const section = $("librarySection");
  const title = $("libraryTitle");
  const subtitle = $("librarySubtitle");
  const content = $("libraryContent");

  section.classList.toggle(
    "hidden",
    route === "home" || route === "account"
  );

  $("accountSection").classList.toggle(
    "hidden",
    route !== "account"
  );

  title.textContent = titleMap[route][0];
  subtitle.textContent = titleMap[route][1];

  if (route === "classes") {
    renderClasses(content);
  } else if (route === "jee-neet") {
    renderExam(content);
  } else if (["worksheets", "mock-tests", "pyqs"].includes(route)) {
    loadResources(route);
  } else if (route === "account") {
    $("accountSection").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  } else if (route === "home") {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (route !== "account" && route !== "home") {
    section.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
}

function renderClasses(content) {
  content.innerHTML = `
    <div class="class-grid">
      ${Array.from({ length: 12 }, (_, i) => `
        <button class="class-card" data-class="${i + 1}">
          <strong>Class ${i + 1}</strong>
          <span>Subjects · Worksheets · Practice papers</span>
        </button>
      `).join("")}
    </div>
    <div id="classDetails"></div>
  `;

  content.querySelectorAll("[data-class]").forEach(btn => {
    btn.addEventListener("click", () => {
      loadClassResources(Number(btn.dataset.class));
    });
  });
}

function renderExam(content) {
  content.innerHTML = `
    <div class="resource-grid">
      <button class="class-card" data-exam="JEE">
        <strong>JEE Main & Advanced</strong>
        <span>Physics · Chemistry · Mathematics</span>
      </button>
      <button class="class-card" data-exam="NEET">
        <strong>NEET UG</strong>
        <span>Physics · Chemistry · Biology</span>
      </button>
    </div>
    <div id="examDetails"></div>
  `;

  content.querySelectorAll("[data-exam]").forEach(btn => {
    btn.addEventListener("click", () => {
      loadExamResources(btn.dataset.exam);
    });
  });
}

function resourceCard(r) {
  return `
    <article class="resource-card">
      <span class="tag">${escapeHTML(r.resource_type || "Resource")}</span>
      <h3>${escapeHTML(r.title)}</h3>
      <p>${escapeHTML([
        r.category,
        r.level,
        r.subject,
        r.topic
      ].filter(Boolean).join(" · "))}</p>
      <div class="resource-content">${escapeHTML(r.content || "")}</div>
      ${r.answer ? `
        <details>
          <summary>View answer / explanation</summary>
          <p class="resource-content">${escapeHTML(r.answer)}</p>
        </details>
      ` : ""}
      ${r.is_demo ? `
        <p class="muted">Sample question · replace with verified content</p>
      ` : ""}
    </article>
  `;
}

async function loadResources(route, query = "") {
  const content = $("libraryContent");

  content.innerHTML = `
    <div class="empty-state">
      <h3>Loading practice library…</h3>
      <p>Checking available published resources.</p>
    </div>
  `;

  if (!supabaseClient) {
    content.innerHTML = demoResources(route, query);
    return;
  }

  let q = supabaseClient
    .from("resources")
    .select("id,title,category,level,subject,topic,resource_type,content,answer,created_at")
    .eq("published", true)
    .order("created_at", { ascending: false })
    .limit(100);

  if (route === "worksheets") {
    q = q.eq("resource_type", "Worksheet");
  }

  if (route === "pyqs") {
    q = q.eq("resource_type", "PYQ");
  }

  if (route === "mock-tests") {
    q = q.eq("resource_type", "Mock test");
  }

  if (query) {
    const safeQuery = query.replace(/[%_,()]/g, " ");
    q = q.or(
      `title.ilike.%${safeQuery}%,subject.ilike.%${safeQuery}%,topic.ilike.%${safeQuery}%`
    );
  }

  const { data, error } = await q;

  if (error) {
    content.innerHTML = `
      <div class="empty-state">
        <h3>Could not load resources</h3>
        <p>Check your database setup and try again.</p>
      </div>
    `;
    return;
  }

  activeResources = data || [];

  content.innerHTML = activeResources.length
    ? `<div class="resource-grid">${activeResources.map(resourceCard).join("")}</div>`
    : `
      <div class="empty-state">
        <span class="empty-symbol">✦</span>
        <h3>No published resources yet</h3>
        <p>An administrator can add verified worksheets, PYQs and mock-test sets in the admin workspace.</p>
      </div>
    `;
}

function demoResources(route, query = "") {
  const label =
    route === "worksheets" ? "Worksheet" :
    route === "pyqs" ? "PYQ" :
    route === "mock-tests" ? "Mock test" :
    "Practice paper";

  const samples = [
    {
      title: "Sample: Mathematics practice",
      category: "Class 1–12",
      level: "Class 10",
      subject: "Mathematics",
      topic: "Algebra",
      resource_type: "Worksheet",
      content: "Add verified questions and an answer key from the admin workspace.",
      answer: "Add a step-by-step explanation.",
      is_demo: true
    },
    {
      title: "Sample: Science revision",
      category: "Class 1–12",
      level: "Class 9",
      subject: "Science",
      topic: "Matter",
      resource_type: label,
      content: "This is placeholder content to demonstrate the layout.",
      answer: "Replace with reviewed answers.",
      is_demo: true
    },
    {
      title: "Sample: Competitive exam practice",
      category: "JEE",
      level: "JEE",
      subject: "Physics",
      topic: "Mechanics",
      resource_type: label,
      content: "Question library is not connected yet. Configure Supabase to save real content.",
      answer: "",
      is_demo: true
    }
  ].filter(r =>
    (route !== "worksheets" || r.resource_type === "Worksheet") &&
    (!query || JSON.stringify(r).toLowerCase().includes(query.toLowerCase()))
  );

  return samples.length
    ? `
      <div class="resource-grid">
        ${samples.map(resourceCard).join("")}
      </div>
      <p class="muted">Demo preview only. Configure Supabase and publish verified resources for real content.</p>
    `
    : `
      <div class="empty-state">
        <h3>No sample matches</h3>
        <p>Try a different search.</p>
      </div>
    `;
}

async function loadClassResources(level) {
  const box = $("classDetails");
  if (!box) return;

  box.innerHTML = `
    <div class="empty-state">
      <h3>Class ${level}</h3>
      <p>Loading resources…</p>
    </div>
  `;

  if (!supabaseClient) {
    box.innerHTML = `
      <div class="empty-state">
        <h3>Class ${level}</h3>
        <p>Once connected, verified resources for this class will appear here.</p>
      </div>
    `;
    return;
  }

  const { data, error } = await supabaseClient
    .from("resources")
    .select("*")
    .eq("published", true)
    .eq("level", `Class ${level}`)
    .limit(100);

  if (error) {
    box.innerHTML =
      '<p class="form-message error">Could not load class resources.</p>';
    return;
  }

  box.innerHTML = data?.length
    ? `<div class="resource-grid">${data.map(resourceCard).join("")}</div>`
    : `<p class="muted">No published resources for Class ${level} yet.</p>`;
}

async function loadExamResources(exam) {
  const box = $("examDetails");
  if (!box) return;

  box.innerHTML = `
    <div class="empty-state">
      <h3>${escapeHTML(exam)} resources</h3>
      <p>Loading resources…</p>
    </div>
  `;

  if (!supabaseClient) {
    box.innerHTML = `
      <div class="empty-state">
        <h3>${escapeHTML(exam)} resources</h3>
        <p>Configure the database to publish verified ${escapeHTML(exam)} questions.</p>
      </div>
    `;
    return;
  }

  const { data, error } = await supabaseClient
    .from("resources")
    .select("*")
    .eq("published", true)
    .eq("category", exam)
    .limit(100);

  if (error) {
    box.innerHTML =
      '<p class="form-message error">Could not load exam resources.</p>';
    return;
  }

  box.innerHTML = data?.length
    ? `<div class="resource-grid">${data.map(resourceCard).join("")}</div>`
    : `<p class="muted">No published resources for ${escapeHTML(exam)} yet.</p>`;
}

function initTurnstile() {
  if (
    !CONFIG.turnstileSiteKey ||
    CONFIG.turnstileSiteKey.startsWith("YOUR_")
  ) {
    return;
  }

  const tryRender = () => {
    if (
      window.turnstile &&
      $("turnstileWidget") &&
      turnstileWidgetId === null
    ) {
      turnstileWidgetId = window.turnstile.render("#turnstileWidget", {
        sitekey: CONFIG.turnstileSiteKey,
        theme: "light",
        callback: token => turnstileToken = token,
        "expired-callback": () => turnstileToken = "",
        "error-callback": () => turnstileToken = ""
      });
    }
  };

  const interval = window.setInterval(() => {
    tryRender();

    if (turnstileWidgetId !== null) {
      window.clearInterval(interval);
    }
  }, 300);

  window.setTimeout(() => window.clearInterval(interval), 10000);
}

function resetTurnstile() {
  turnstileToken = "";

  if (window.turnstile && turnstileWidgetId !== null) {
    window.turnstile.reset(turnstileWidgetId);
  }
}

function setAuthMode(mode) {
  authMode = mode;

  document.querySelectorAll("[data-auth-mode]").forEach(b => {
    b.classList.toggle("active", b.dataset.authMode === mode);
  });

  $("authSubmit").textContent =
    mode === "signup" ? "Create account securely" : "Sign in securely";

  $("authPassword").autocomplete =
    mode === "signup" ? "new-password" : "current-password";

  setMessage("authMessage", "");
}

async function handleAuth(event) {
  event.preventDefault();

  if (!supabaseClient) {
    setMessage(
      "authMessage",
      "Authentication isn't configured yet. Follow README.md to connect Supabase and Turnstile.",
      true
    );
    return;
  }

  if (!turnstileToken) {
    setMessage(
      "authMessage",
      "Please complete the human verification first.",
      true
    );
    return;
  }

  const email = $("authEmail").value.trim();
  const password = $("authPassword").value;

  $("authSubmit").disabled = true;
  $("authSubmit").textContent = "Please wait…";

  try {
    const result = authMode === "signup"
      ? await supabaseClient.auth.signUp({
          email,
          password,
          options: {
            captchaToken: turnstileToken,
            emailRedirectTo: location.origin
          }
        })
      : await supabaseClient.auth.signInWithPassword({
          email,
          password,
          options: { captchaToken: turnstileToken }
        });

    if (result.error) throw result.error;

    if (authMode === "signup" && !result.data.session) {
      setMessage(
        "authMessage",
        "Account created. Check your email to verify the address before signing in."
      );
    } else {
      setMessage("authMessage", "Signed in successfully.");
      await updateAccountUI(result.data.user);
    }
  } catch (e) {
    setMessage(
      "authMessage",
      e.message || "Authentication failed. Check your details and try again.",
      true
    );
  } finally {
    $("authSubmit").disabled = false;
    $("authSubmit").textContent =
      authMode === "signup" ? "Create account securely" : "Sign in securely";

    resetTurnstile();
  }
}

async function updateAccountUI(user) {
  const panel = $("signedInPanel");

  if (!user) {
    panel.classList.add("hidden");
    $("authForm").classList.remove("hidden");
    $("accountNav").textContent = "Sign in";
    $("adminSection").classList.add("hidden");
    return;
  }

  $("authForm").classList.add("hidden");
  panel.classList.remove("hidden");
  $("accountNav").textContent = "My account";

  panel.innerHTML = `
    <h3>You're signed in</h3>
    <p class="muted">${escapeHTML(user.email || "Account")}</p>
    <p class="muted">Email verified: ${user.email_confirmed_at ? "Yes" : "Not yet"}</p>
    <button class="button secondary" id="signOutButton" type="button">Sign out</button>
  `;

  $("signOutButton").addEventListener("click", async () => {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
      toast("Could not sign out. Please try again.");
      return;
    }

    toast("Signed out.");
    await updateAccountUI(null);
  });

  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!error && profile?.role === "admin") {
    $("adminSection").classList.remove("hidden");
    await loadAdminResources();
  } else {
    $("adminSection").classList.add("hidden");
  }
}

async function resetPassword() {
  if (!supabaseClient) {
    setMessage(
      "authMessage",
      "Configure Supabase first to enable password reset.",
      true
    );
    return;
  }

  const email = $("authEmail").value.trim();

  if (!email) {
    setMessage("authMessage", "Enter your email address first.", true);
    return;
  }

  const { error } = await supabaseClient.auth.resetPasswordForEmail(
    email,
    { redirectTo: location.origin + "#account" }
  );

  setMessage(
    "authMessage",
    error
      ? error.message
      : "If an account exists for that email, a password-reset email will be sent.",
    !!error
  );
}

async function loadAdminResources() {
  const box = $("adminResources");
  if (!supabaseClient) return;

  const { data, error } = await supabaseClient
    .from("resources")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    box.innerHTML =
      '<p class="form-message error">Admin resources could not be loaded.</p>';
    return;
  }

  box.innerHTML = (data || []).map(r => `
  <article class="resource-card">
    <span class="tag">${escapeHTML(r.published ? "Published" : "Draft")}</span>
    <h3>${escapeHTML(r.title)}</h3>
    <p>${escapeHTML([r.category, r.level, r.subject, r.topic].join(" · "))}</p>

    <button class="button secondary small"
      data-edit-resource="${escapeHTML(r.id)}">
      Edit
    </button>

    <button class="button secondary small"
      data-toggle-publish="${escapeHTML(r.id)}"
      data-published="${r.published}">
      ${r.published ? "Unpublish" : "Publish"}
    </button>

    <button class="button secondary small"
      data-delete-resource="${escapeHTML(r.id)}">Delete</button>
  </article>
`).join("") || '<p class="muted">No resources yet.</p>';
box.querySelectorAll("[data-edit-resource]").forEach(b => {
  b.addEventListener("click", () => {
    const resource = (data || []).find(
      r => String(r.id) === b.dataset.editResource
    );

    if (!resource) return;

    editingResourceId = resource.id;

    $("qTitle").value = resource.title || "";
    $("qCategory").value = resource.category || "Class 1–12";
    $("qLevel").value = resource.level || "";
    $("qSubject").value = resource.subject || "";
    $("qTopic").value = resource.topic || "";
    $("qType").value = resource.resource_type || "Worksheet";
    $("qContent").value = resource.content || "";
    $("qAnswer").value = resource.answer || "";
    $("qPublished").checked = !!resource.published;

    const form = $("questionForm");
    const submitButton = form.querySelector(
      'button[type="submit"], input[type="submit"]'
    );

    if (submitButton) {
      if (!originalResourceSubmitText) {
        originalResourceSubmitText =
          submitButton.tagName === "INPUT"
            ? submitButton.value
            : submitButton.textContent;
      }

      if (submitButton.tagName === "INPUT") {
        submitButton.value = "Save Changes";
      } else {
        submitButton.textContent = "Save Changes";
      }
    }

    let cancelButton = $("cancelResourceEdit");

    if (!cancelButton) {
      cancelButton = document.createElement("button");
      cancelButton.id = "cancelResourceEdit";
      cancelButton.type = "button";
      cancelButton.className = "button secondary";
      cancelButton.textContent = "Cancel Edit";

      form.appendChild(cancelButton);

      cancelButton.addEventListener(
        "click",
        resetResourceEditor
      );
    }

    setMessage(
      "adminMessage",
      "Editing resource. Save Changes to update it."
    );

    form.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  });
});
  box.querySelectorAll("[data-toggle-publish]").forEach(b => {
    b.addEventListener("click", async () => {
      const { error } = await supabaseClient
        .from("resources")
        .update({ published: b.dataset.published !== "true" })
        .eq("id", b.dataset.togglePublish);

      if (error) {
        toast("Could not update resource.");
      } else {
        toast("Resource updated.");
        await loadAdminResources();
      }
    });
  });

  box.querySelectorAll("[data-delete-resource]").forEach(b => {
    b.addEventListener("click", async () => {
      if (!confirm("Delete this resource permanently?")) return;

      const { error } = await supabaseClient
        .from("resources")
        .delete()
        .eq("id", b.dataset.deleteResource);

      if (error) {
        toast("Could not delete resource.");
      } else {
        toast("Resource deleted.");
        await loadAdminResources();
      }
    });
  });
}

async function saveResource(event) {
  event.preventDefault();

  if (!supabaseClient) {
    setMessage("adminMessage", "Configure Supabase first.", true);
    return;
  }

  const resource = {
    title: $("qTitle").value.trim(),
    category: $("qCategory").value,
    level: $("qLevel").value.trim(),
    subject: $("qSubject").value.trim(),
    topic: $("qTopic").value.trim(),
    resource_type: $("qType").value,
    content: $("qContent").value.trim(),
    answer: $("qAnswer").value.trim() || null,
    published: $("qPublished").checked
  };

  const wasEditing = editingResourceId !== null;

  const result = wasEditing
    ? await supabaseClient
        .from("resources")
        .update(resource)
        .eq("id", editingResourceId)
    : await supabaseClient
        .from("resources")
        .insert(resource);

  if (result.error) {
    setMessage("adminMessage", result.error.message, true);
    return;
  }

  resetResourceEditor();

  setMessage(
    "adminMessage",
    wasEditing ? "Resource updated." : "Resource saved."
  );

  await loadAdminResources();
}

function resetResourceEditor() {
  editingResourceId = null;

  const form = $("questionForm");

  if (form) form.reset();

  const cancelButton = $("cancelResourceEdit");
  if (cancelButton) cancelButton.remove();

  const submitButton = form?.querySelector(
    'button[type="submit"], input[type="submit"]'
  );

  if (submitButton && originalResourceSubmitText) {
    if (submitButton.tagName === "INPUT") {
      submitButton.value = originalResourceSubmitText;
    } else {
      submitButton.textContent = originalResourceSubmitText;
    }
  }

  setMessage("adminMessage", "");
}

function initSearch() {
  const run = () => {
    const q = $("questionSearch").value.trim();

    if (!q) {
      setMessage("searchMessage", "Enter a topic, subject, class or exam to search.");
      return;
    }

    setMessage("searchMessage", `Searching for “${q}”…`);

    const route = location.hash.slice(1);
    const targetRoute = ["worksheets", "mock-tests", "pyqs"].includes(route)
      ? route
      : "worksheets";

    loadResources(targetRoute, q).then(() => {
      setMessage("searchMessage", `Showing matching resources for “${q}”.`);
    });
  };

  $("searchButton").addEventListener("click", run);

  $("questionSearch").addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      run();
    }
  });

  document.querySelectorAll("[data-search]").forEach(b => {
    b.addEventListener("click", () => {
      $("questionSearch").value = b.dataset.search;
      run();
    });
  });
}

function init() {
  $("year").textContent = new Date().getFullYear();

  $("mobileMenu").addEventListener("click", () => {
    const open = $("mainNav").classList.toggle("open");
    $("mobileMenu").setAttribute("aria-expanded", String(open));
  });

  document.querySelectorAll("[data-auth-mode]").forEach(b => {
    b.addEventListener("click", () => setAuthMode(b.dataset.authMode));
  });

  $("authForm").addEventListener("submit", handleAuth);
  $("resetPassword").addEventListener("click", resetPassword);
  $("questionForm").addEventListener("submit", saveResource);

  initSearch();

  window.addEventListener("hashchange", () => {
    renderRoute(location.hash.slice(1) || "home");
  });

  renderRoute(location.hash.slice(1) || "home");
  initTurnstile();

  if (supabaseClient) {
    supabaseClient.auth.getSession().then(({ data, error }) => {
      if (!error) {
        updateAccountUI(data.session?.user || null);
      }
    });

    supabaseClient.auth.onAuthStateChange((_event, session) => {
      updateAccountUI(session?.user || null);
    });
  } else {
    setMessage(
      "authMessage",
      "Preview mode: connect Supabase and Turnstile to enable real secure accounts."
    );
  }
}

document.addEventListener("DOMContentLoaded", init);
