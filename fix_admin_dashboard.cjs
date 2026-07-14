const fs = require('fs');
let code = fs.readFileSync('src/AdminDashboard.tsx', 'utf-8');

const targetUseEffect = `// Calculate Platform Metrics
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        const tradesSnap = await getDocs(collection(db, "syndicate_ledger"));
        let tradesCount = 0;
        
        tradesSnap.forEach(doc => {
          const data = doc.data();
          if (data.timestamp && new Date(data.timestamp) >= oneWeekAgo) {
            tradesCount++;
          }
        });
        
        let totalRevenue = 0;
        for (const client of clients) {
          try {
            const apptsSnap = await getDocs(collection(db, "clients", client.domain, "appointments"));
            apptsSnap.forEach(doc => {
              const data = doc.data();
              if (data.createdAt && new Date(data.createdAt) >= oneWeekAgo) {
                totalRevenue += (data.value || 150);
              }
            });
          } catch(e) {}
        }
        setPlatformMetrics({ trades: tradesCount, revenue: totalRevenue });
      } catch (err) {
        console.error("Failed to fetch platform metrics", err);
      }
    };
    if (clients.length > 0) {
      fetchMetrics();
    }
  }, [clients]);`;

const replacementUseEffect = `// Listen to the single global platform_stats document
  useEffect(() => {
    const docRef = doc(db, "_metadata", "platform_stats");
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPlatformMetrics({ 
          trades: data.weeklyTrades || 0, 
          revenue: data.weeklyRevenue || 0 
        });
      }
    }, (err) => {
      console.error("Failed to listen to platform stats:", err);
    });
    return () => unsubscribe();
  }, []);`;

code = code.replace(targetUseEffect, replacementUseEffect);

const targetImport = `import { collection, onSnapshot, query, getDocs } from "firebase/firestore";`;
const replacementImport = `import { collection, onSnapshot, query, getDocs, doc } from "firebase/firestore";`;
code = code.replace(targetImport, replacementImport);

fs.writeFileSync('src/AdminDashboard.tsx', code);
