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

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Debugging check
console.log("Firebase initialized:", firebase.app().name);

document.addEventListener("DOMContentLoaded", function () {
  const queueTable = document.getElementById("queueTable");
  const totalCount = document.getElementById("totalCount");
  const refreshBtn = document.getElementById("refreshBtn");
  const clearCompletedBtn = document.getElementById("clearCompletedBtn");
  const clearAllBtn = document.getElementById("clearAllBtn");

  // Debug element
  const debugDiv = document.createElement("div");
  debugDiv.style.position = "fixed";
  debugDiv.style.bottom = "10px";
  debugDiv.style.right = "10px";
  debugDiv.style.backgroundColor = "#f8f9fa";
  debugDiv.style.padding = "10px";
  debugDiv.style.border = "1px solid #ddd";
  debugDiv.style.borderRadius = "5px";
  debugDiv.style.zIndex = "1000";
  debugDiv.style.display = "none"; // Hide by default
  document.body.appendChild(debugDiv);

  // Real-time listener with error handling
  function setupQueueListener() {
    return db
      .collection("queue")
      .orderBy("timestamp", "asc")
      .onSnapshot(
        (snapshot) => {
          debugDiv.innerHTML = `Connected to Firestore`;

          queueTable.innerHTML = "";
          let waitingCount = 0;

          snapshot.forEach((doc) => {
            const data = doc.data();
            
            // Increment waitingCount for all items
            waitingCount++;
            
            const row = document.createElement("tr");
            row.innerHTML = `
              <td>Q-${data.queueNumber.toString().padStart(3, "0")}</td>
              <td>${data.name || "N/A"}</td>
              <td>${data.partySize || "N/A"}</td>
              <td>${formatTime(data.timestamp?.toDate())}</td>
              <td><span class="badge ${getStatusClass(data.status)}">${
              data.status || "waiting"
            }</span></td>
              <td>
                <button class="btn btn-sm btn-success complete-btn" data-id="${doc.id}">Complete</button>
                <button class="btn btn-sm btn-danger remove-btn" data-id="${doc.id}">Remove</button>
              </td>
            `;
            queueTable.appendChild(row);
          });

          // Update the total count display
          totalCount.textContent = waitingCount;

          // Add event listeners to new buttons
          document.querySelectorAll(".complete-btn").forEach((btn) => {
            btn.addEventListener("click", () => completeCustomer(btn.dataset.id));
          });

          document.querySelectorAll(".remove-btn").forEach((btn) => {
            btn.addEventListener("click", () => removeCustomer(btn.dataset.id));
          });
        },
        (error) => {
          console.error("Firestore error:", error);
          debugDiv.innerHTML = `Error: ${error.message}`;
          debugDiv.style.display = "block"; // Show on error
        }
      );
  }

  // Initialize listener
  let unsubscribe = setupQueueListener();

  // Add refresh button functionality
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      // Unsubscribe and resubscribe to refresh
      if (unsubscribe) {
        unsubscribe();
      }
      unsubscribe = setupQueueListener();
    });
  }

  // Add clear buttons functionality
  if (clearCompletedBtn) {
    clearCompletedBtn.addEventListener("click", clearCompleted);
  }
  
  if (clearAllBtn) {
    clearAllBtn.addEventListener("click", clearAll);
  }

  // Ensure debug element is hidden on initialization
  const debugEl = document.getElementById("firebase-debug");
  if (debugEl) {
    debugEl.style.display = "none";

    // Your existing debug code can remain
    db.collection("queue")
      .limit(1)
      .get()
      .then((snap) => {
        debugEl.textContent = `Connected: ${snap.size} docs`;
        // Message will be there if you need to inspect it
      })
      .catch((err) => {
        debugEl.textContent = `Error: ${err.message}`;
        debugEl.style.display = "block"; // Only show on error
        debugEl.classList.add("alert-danger");
      });
  }

  // Helper functions
  function formatTime(date) {
    if (!date) return "N/A";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function getStatusClass(status) {
    return status === "completed"
      ? "bg-success"
      : status === "serving"
      ? "bg-primary"
      : "bg-danger";
  }

  function isMobile() {
    return window.innerWidth < 768;
  }

  // Add this after Firebase initialization
  async function debugFirestoreConnection() {
    try {
      // Test with a direct query
      const snapshot = await db.collection("queue").get();
      console.log(`Connected to Firestore: ${snapshot.size} documents found.`);
    } catch (error) {
      console.error("Firestore connection error:", error);
    }
  }

  debugFirestoreConnection();

  async function completeCustomer(id) {
    try {
      await db.collection("queue").doc(id).update({
        status: "completed",
        completedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      console.error("Error completing customer:", error);
      alert("Error updating status");
    }
  }

  async function removeCustomer(id) {
    if (confirm("Remove this customer from queue?")) {
      try {
        await db.collection("queue").doc(id).delete();
      } catch (error) {
        console.error("Error removing customer:", error);
        alert("Error removing customer");
      }
    }
  }

  async function clearCompleted() {
    if (confirm("Are you sure you want to clear all completed customers from the queue?")) {
      try {
        // Get all completed items
        const completedSnapshot = await db
          .collection("queue")
          .where("status", "==", "completed")
          .get();
        
        if (completedSnapshot.empty) {
          alert("No completed customers to clear.");
          return;
        }
        
        // Use a batch for efficient multiple deletes
        const batch = db.batch();
        completedSnapshot.forEach((doc) => {
          batch.delete(doc.ref);
        });
        
        // Commit the batch
        await batch.commit();
        console.log(`Cleared ${completedSnapshot.size} completed customers`);
        alert(`Successfully cleared ${completedSnapshot.size} completed customers`);
      } catch (error) {
        console.error("Error clearing completed customers:", error);
        alert("Error clearing completed customers: " + error.message);
      }
    }
  }

  async function clearAll() {
    if (confirm("WARNING: Are you sure you want to clear ALL customers from the queue? This cannot be undone.")) {
      try {
        // Get all queue items
        const snapshot = await db.collection("queue").get();
        
        if (snapshot.empty) {
          alert("Queue is already empty.");
          return;
        }
        
        // Use a batch for efficient multiple deletes
        const batch = db.batch();
        snapshot.forEach((doc) => {
          batch.delete(doc.ref);
        });
        
        // Commit the batch
        await batch.commit();
        console.log(`Cleared entire queue (${snapshot.size} customers)`);
        alert(`Successfully cleared entire queue (${snapshot.size} customers)`);
      } catch (error) {
        console.error("Error clearing all customers:", error);
        alert("Error clearing queue: " + error.message);
      }
    }
  }

  // Automatic date-based reset (no server needed)
  async function checkDailyReset() {
    const today = new Date().toDateString();
    const lastReset = localStorage.getItem("lastResetDate");

    if (lastReset !== today) {
      try {
        await db
          .collection("metadata")
          .doc("queueCounter")
          .set({ lastNumber: 0 });
        localStorage.setItem("lastResetDate", today);
        console.log("Daily counter reset");
      } catch (error) {
        console.error("Reset failed:", error);
      }
    }
  }

  // Call this when admin page loads
  checkDailyReset();
});