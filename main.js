// main.js (partially updated parseExcelData)
function parseExcelData(data) {
    try {
        const workbook = XLSX.read(data, { type: 'buffer' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        // Đọc dữ liệu thô dạng mảng
        const dataAsArrays = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false });
        if (!dataAsArrays || dataAsArrays.length < 2) return [];

        // Bỏ qua hàng tiêu đề, đọc hàng dữ liệu dựa trên vị trí cố định (Index)
        // 0: JOB_ID, 1: PROMPT, 2-11: IMAGE_PATHs, 12: STATUS, 13: VIDEO_NAME, 14: TYPE_VIDEO
        return dataAsArrays.slice(1).map((row, index) => {
            if (!row || row.length < 1) return null;
            
            const get = (idx) => (row[idx] !== undefined && row[idx] !== null) ? String(row[idx]).trim() : '';
            const statusStr = get(12);
            
            return {
                id: get(0) || `job_${index + 1}`,
                prompt: get(1) || '',
                imagePath: get(2),
                imagePath2: get(3),
                imagePath3: get(4),
                imagePath4: get(5),
                imagePath5: get(6),
                imagePath6: get(7),
                imagePath7: get(8),
                imagePath8: get(9),
                imagePath9: get(10),
                imagePath10: get(11),
                status: ['Pending', 'Processing', 'Generating', 'Completed', 'Failed'].includes(statusStr) ? statusStr : '',
                videoName: get(13),
                typeVideo: get(14),
                videoPath: undefined, // Sẽ được scan sau
            };
        }).filter(job => job !== null && job.id);
    } catch (e) { 
        console.error("Lỗi parse Excel:", e);
        return []; 
    }
}

// ... giữ phần còn lại của main.js ...
