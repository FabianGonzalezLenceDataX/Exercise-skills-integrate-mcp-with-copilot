document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const userIcon = document.getElementById("user-icon");
  const userStatus = document.getElementById("user-status");
  const closeBtn = document.querySelector(".close");
  const loginMessage = document.getElementById("login-message");
  const teacherNotice = document.getElementById("teacher-only-notice");

  // Authentication state
  let authToken = localStorage.getItem("authToken");
  let currentUser = localStorage.getItem("currentUser");

  // Update UI based on authentication state
  function updateAuthUI() {
    if (authToken) {
      userStatus.textContent = `Logged in as ${currentUser}`;
      userStatus.classList.add("logged-in");
      teacherNotice.classList.add("hidden");
      signupForm.querySelector('button[type="submit"]').disabled = false;
    } else {
      userStatus.textContent = "";
      userStatus.classList.remove("logged-in");
      teacherNotice.classList.remove("hidden");
      signupForm.querySelector('button[type="submit"]').disabled = true;
    }
  }

  // Show login modal
  userIcon.addEventListener("click", () => {
    if (authToken) {
      // If logged in, show logout option
      if (confirm(`Logged in as ${currentUser}. Do you want to logout?`)) {
        logout();
      }
    } else {
      loginModal.classList.remove("hidden");
    }
  });

  // Close modal
  closeBtn.addEventListener("click", () => {
    loginModal.classList.add("hidden");
    loginForm.reset();
    loginMessage.textContent = "";
  });

  // Handle login
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      if (response.ok) {
        authToken = result.token;
        currentUser = result.username;
        localStorage.setItem("authToken", authToken);
        localStorage.setItem("currentUser", currentUser);
        loginModal.classList.add("hidden");
        loginForm.reset();
        updateAuthUI();
        fetchActivities(); // Refresh to show delete buttons
      } else {
        loginMessage.textContent = result.detail || "Login failed";
        loginMessage.className = "error";
      }
    } catch (error) {
      loginMessage.textContent = "Login failed. Please try again.";
      loginMessage.className = "error";
      console.error("Login error:", error);
    }
  });

  // Logout function
  async function logout() {
    try {
      await fetch("/logout", {
        method: "POST",
        headers: {
          Authorization: authToken,
        },
      });
    } catch (error) {
      console.error("Logout error:", error);
    }

    authToken = null;
    currentUser = null;
    localStorage.removeItem("authToken");
    localStorage.removeItem("currentUser");
    updateAuthUI();
    fetchActivities(); // Refresh to hide delete buttons
  }

  // Initialize auth UI
  updateAuthUI();

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Only show delete buttons if user is authenticated
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li>
                        <span class="participant-email">${email}</span>
                        ${authToken ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>` : ''}
                      </li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons (only if authenticated)
      if (authToken) {
        document.querySelectorAll(".delete-btn").forEach((button) => {
          button.addEventListener("click", handleUnregister);
        });
      }
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    if (!authToken) {
      alert("You must be logged in as a teacher to unregister students.");
      return;
    }

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: authToken,
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
        
        // If unauthorized, clear auth and refresh
        if (response.status === 401) {
          logout();
        }
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to unregister. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!authToken) {
      alert("You must be logged in as a teacher to register students.");
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: {
            Authorization: authToken,
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
        
        // If unauthorized, clear auth and refresh
        if (response.status === 401) {
          logout();
        }
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  fetchActivities();
});
