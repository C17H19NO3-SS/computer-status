const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');
const si = require('systeminformation');

const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.render('index');
});

// Yardımcı fonksiyon: Byte cinsinden değeri okunabilir GB formatına çevirir
const bytesToGB = (bytes) => {
    if (bytes === 0) return '0 GB';
    return (bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB';
};

// Sistem bilgilerini alıp frontend'in beklediği formata dönüştüren fonksiyon
async function getSystemStats() {
    try {
        const cpu = await si.cpu();
        const mem = await si.mem();
        const fs = await si.fsSize(); // Dosya sistemi bilgileri (disk)
        // const currentLoad = await si.currentLoad(); // İşlemci kullanım yüzdesini almak için kullanılabilir

        let totalDiskBytes = 0;
        let usedDiskBytes = 0;
        let availableDiskBytes = 0;

        // Birden fazla disk bölümü olabilir, hepsini topla
        fs.forEach(drive => {
            totalDiskBytes += drive.size;
            usedDiskBytes += drive.used;
            availableDiskBytes += drive.available;
        });

        // Yüzde hesaplamaları
        const memUsedPercentage = mem.total > 0 ? ((mem.used / mem.total) * 100).toFixed(1) : 0;
        const diskUsedPercentage = totalDiskBytes > 0 ? ((usedDiskBytes / totalDiskBytes) * 100).toFixed(1) : 0;
        const swapUsedPercentage = mem.swaptotal > 0 ? ((mem.swapused / mem.swaptotal) * 100).toFixed(1) : 0;

        return {
            // İşlemci Bilgileri (değişmedi)
            cpu: cpu.manufacturer + ' ' + cpu.brand + ' @ ' + (cpu.speedMax).toFixed(2) + 'GHz',
            cpuCore: cpu.cores,
            cpuPhysicalCores: cpu.physicalCores,

            // Bellek Bilgileri
            memUsageSummary: `${bytesToGB(mem.used)} / ${bytesToGB(mem.total)}`, // Kullanılan / Toplam
            freeMem: bytesToGB(mem.free), // Boş alan
            memUsedPercentage: memUsedPercentage, // Kullanım yüzdesi

            // Disk Bilgileri
            diskUsageSummary: `${bytesToGB(usedDiskBytes)} / ${bytesToGB(totalDiskBytes)}`, // Kullanılan / Toplam
            availableDisk: bytesToGB(availableDiskBytes), // Boş alan
            diskUsedPercentage: diskUsedPercentage, // Kullanım yüzdesi

            // Swap Bilgileri
            swapUsageSummary: `${bytesToGB(mem.swapused)} / ${bytesToGB(mem.swaptotal)}`, // Kullanılan / Toplam
            freeSwap: bytesToGB(mem.swapfree), // Boş alan
            swapUsedPercentage: swapUsedPercentage, // Kullanım yüzdesi
        };
    } catch (e) {
        console.error('Sistem bilgileri alınırken hata oluştu:', e);
        return {};
    }
}

io.on('connection', async (socket) => {
    console.log('Yeni bir kullanıcı bağlandı');

    const initialStats = await getSystemStats();
    socket.emit('stat', initialStats);

    const interval = setInterval(async () => {
        const currentStats = await getSystemStats();
        socket.emit('stat', currentStats);
    }, 1000);

    socket.on('disconnect', () => {
        console.log('Kullanıcı bağlantısı kesildi');
        clearInterval(interval);
    });
});

http.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor`);
});