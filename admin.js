// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCwv0xOOliAnlXivDEVnndaVXPf91C5fA8",
  authDomain: "crescent-queue-system.firebaseapp.com",
  projectId: "crescent-queue-system",
  storageBucket: "crescent-queue-system.firebasestorage.app",
  messagingSenderId: "326862097681",
  appId: "1:326862097681:web:e0205177054de6f90010b0",
  measurementId: "G-ZGT8Y8V3ZC",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

console.log("Firebase initialized:", firebase.app().name);

document.addEventListener("DOMContentLoaded", function () {
  const queueTable = document.getElementById("queueTable");
  const totalCount = document.getElementById("totalCount");
  const waitingCount = document.getElementById("waitingCount");
  const completedCount = document.getElementById("completedCount");
  const refreshBtn = document.getElementById("refreshBtn");
  const clearCompletedBtn = document.getElementById("clearCompletedBtn");
  const clearAllBtn = document.getElementById("clearAllBtn");

  // Edit modal elements
  const editModal = document.getElementById("editModal");
  const editDocId = document.getElementById("editDocId");
  const editName = document.getElementById("editName");
  const editPartySize = document.getElementById("editPartySize");
  const editCancel = document.getElementById("editCancel");
  const editSave = document.getElementById("editSave");

  // ── Toast ──────────────────────────────────────────────
  function showToast(message, type = "success") {
    const toast = document.getElementById("toast");
    toast.textContent = (type === "success" ? "✓ " : "✕ ") + message;
    toast.className = `toast ${type} show`;
    setTimeout(() => { toast.className = "toast"; }, 3000);
  }

  // ── Edit Modal ─────────────────────────────────────────
  function openEditModal(id, name, partySize) {
    editDocId.value = id;
    editName.value = name || "";
    editPartySize.value = partySize || "";
    editModal.classList.add("active");
    editName.focus();
  }

  function closeEditModal() {
    editModal.classList.remove("active");
    editDocId.value = "";
    editName.value = "";
    editPartySize.value = "";
  }

  editCancel.addEventListener("click", closeEditModal);

  // Close modal on overlay click
  editModal.addEventListener("click", (e) => {
    if (e.target === editModal) closeEditModal();
  });

  // Close on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeEditModal();
  });

  editSave.addEventListener("click", async () => {
    const id = editDocId.value;
    const name = editName.value.trim();
    const partySize = parseInt(editPartySize.value);

    if (!name) { showToast("Name cannot be empty", "error"); return; }
    if (!partySize || partySize < 1) { showToast("Enter a valid party size", "error"); return; }

    editSave.textContent = "Saving…";
    editSave.disabled = true;

    try {
      await db.collection("queue").doc(id).update({ name, partySize });
      closeEditModal();
      showToast("Entry updated successfully");
    } catch (error) {
      console.error("Error updating entry:", error);
      showToast("Failed to update entry", "error");
    } finally {
      editSave.textContent = "Save Changes";
      editSave.disabled = false;
    }
  });

  // ── Queue Listener ─────────────────────────────────────
  function setupQueueListener() {
    return db
      .collection("queue")
      .orderBy("timestamp", "asc")
      .onSnapshot(
        (snapshot) => {
          queueTable.innerHTML = "";
          let total = 0;
          let waiting = 0;
          let completed = 0;

          if (snapshot.empty) {
            queueTable.innerHTML = `
              <tr>
                <td colspan="6">
                  <div class="empty-state">
                    <div class="icon">🪑</div>
                    <p>No customers in queue</p>
                  </div>
                </td>
              </tr>`;
          }

          snapshot.forEach((doc) => {
            const data = doc.data();
            total++;
            if (data.status === "completed") completed++;
            else waiting++;

            const row = document.createElement("tr");
            row.innerHTML = `
              <td><span class="queue-num">Q-${data.queueNumber?.toString().padStart(3, "0") || "?"}</span></td>
              <td><span class="customer-name">${data.name || "N/A"}</span></td>
              <td><span class="party-size">👥 ${data.partySize || "N/A"}</span></td>
              <td><span class="time-cell">${formatTime(data.timestamp?.toDate())}</span></td>
              <td><span class="badge-status ${getStatusClass(data.status)}">${data.status || "waiting"}</span></td>
              <td>
                <div class="actions">
                  <button class="btn-action btn-complete complete-btn" data-id="${doc.id}">✓ Done</button>
                  <button class="btn-action btn-edit edit-btn" data-id="${doc.id}" data-name="${data.name || ""}" data-party="${data.partySize || ""}">✎ Edit</button>
                  <button class="btn-action btn-remove remove-btn" data-id="${doc.id}">✕</button>
                </div>
              </td>
            `;
            queueTable.appendChild(row);
          });

          // Update stats
          totalCount.textContent = total;
          waitingCount.textContent = waiting;
          completedCount.textContent = completed;

          // Button listeners
          document.querySelectorAll(".complete-btn").forEach((btn) => {
            btn.addEventListener("click", () => completeCustomer(btn.dataset.id));
          });

          document.querySelectorAll(".edit-btn").forEach((btn) => {
            btn.addEventListener("click", () =>
              openEditModal(btn.dataset.id, btn.dataset.name, btn.dataset.party)
            );
          });

          document.querySelectorAll(".remove-btn").forEach((btn) => {
            btn.addEventListener("click", () => removeCustomer(btn.dataset.id));
          });
        },
        (error) => {
          console.error("Firestore error:", error);
          showToast("Connection error: " + error.message, "error");
        }
      );
  }

  let unsubscribe = setupQueueListener();

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      if (unsubscribe) unsubscribe();
      unsubscribe = setupQueueListener();
      showToast("Queue refreshed");
    });
  }

  if (clearCompletedBtn) clearCompletedBtn.addEventListener("click", clearCompleted);
  if (clearAllBtn) clearAllBtn.addEventListener("click", clearAll);

  // ── Helpers ────────────────────────────────────────────
  function formatTime(date) {
    if (!date) return "N/A";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function getStatusClass(status) {
    if (status === "completed") return "badge-completed";
    if (status === "serving") return "badge-serving";
    return "badge-waiting";
  }

  // ── Actions ────────────────────────────────────────────
  async function completeCustomer(id) {
    try {
      await db.collection("queue").doc(id).update({
        status: "completed",
        completedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      showToast("Marked as completed");
    } catch (error) {
      console.error("Error completing customer:", error);
      showToast("Error updating status", "error");
    }
  }

  async function removeCustomer(id) {
    if (confirm("Remove this customer from queue?")) {
      try {
        await db.collection("queue").doc(id).delete();
        showToast("Customer removed");
      } catch (error) {
        console.error("Error removing customer:", error);
        showToast("Error removing customer", "error");
      }
    }
  }

  async function clearCompleted() {
    if (confirm("Clear all completed customers?")) {
      try {
        const snap = await db.collection("queue").where("status", "==", "completed").get();
        if (snap.empty) { showToast("No completed customers to clear", "error"); return; }
        const batch = db.batch();
        snap.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        showToast(`Cleared ${snap.size} completed customers`);
      } catch (error) {
        console.error("Error clearing completed:", error);
        showToast("Error clearing completed customers", "error");
      }
    }
  }

  async function clearAll() {
    if (confirm("WARNING: Clear ALL customers? This cannot be undone.")) {
      try {
        const snap = await db.collection("queue").get();
        if (snap.empty) { showToast("Queue is already empty", "error"); return; }
        const batch = db.batch();
        snap.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        showToast(`Cleared entire queue (${snap.size} customers)`);
      } catch (error) {
        console.error("Error clearing queue:", error);
        showToast("Error clearing queue", "error");
      }
    }
  }

  // ── Daily Reset ────────────────────────────────────────
  async function checkDailyReset() {
    const today = new Date().toDateString();
    const lastReset = localStorage.getItem("lastResetDate");
    if (lastReset !== today) {
      try {
        await db.collection("metadata").doc("queueCounter").set({ lastNumber: 0 });
        localStorage.setItem("lastResetDate", today);
        console.log("Daily counter reset");
      } catch (error) {
        console.error("Reset failed:", error);
      }
    }
  }

  checkDailyReset();
});