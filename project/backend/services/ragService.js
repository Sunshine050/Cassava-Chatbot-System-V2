const { PythonShell } = require('python-shell');
const path = require('path');

const generateEmbedding = async (text) => {
  try {
    const scriptPath = path.join(__dirname, 'embedder.py');
    return new Promise((resolve, reject) => {
      PythonShell.run(scriptPath, { args: [text], pythonOptions: ['-u'] }, (err, results) => {
        if (err) {
          logger.error('Embedding generation error', { message: err.message });
          reject(err);
        } else {
          resolve(JSON.parse(results[0]));
        }
      });
    });
  } catch (error) {
    logger.error('Embedding generation failed', { message: error.message });
    throw error;
  }
};

const splitIntoChunks = (text, chunkSize = 1000, overlap = 200) => {
  const chunks = [];
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  let currentChunk = '';

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (currentChunk.length + trimmed.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      const words = currentChunk.split(' ');
      const overlapWords = words.slice(-Math.floor(overlap / 10));
      currentChunk = overlapWords.join(' ') + ' ' + trimmed;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + trimmed;
    }
  }

  if (currentChunk.trim()) chunks.push(currentChunk.trim());
  return chunks.filter((c) => c.length > 50);
};

module.exports = { generateEmbedding, splitIntoChunks };