class FaceService {
  async verifyFace(storedDescriptor, receivedDescriptor) {
    if (!storedDescriptor || !receivedDescriptor) {
      return { match: false, distance: 1, error: 'descriptors_missing' };
    }

    try {
      const stored = new Float32Array(storedDescriptor);
      const received = new Float32Array(receivedDescriptor);

      if (stored.length !== received.length) {
        return { match: false, distance: 1, error: 'descriptor_length_mismatch' };
      }

      const distance = this.euclideanDistance(stored, received);
      const threshold = 0.6;
      const match = distance < threshold;
      const similarity = Math.max(0, (1 - distance) * 100);

      return {
        match,
        distance,
        similarity: similarity.toFixed(2),
        threshold
      };
    } catch (err) {
      console.error('Error en verificación facial:', err.message);
      return { match: false, distance: 1, error: 'verification_error' };
    }
  }

  euclideanDistance(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }
}

module.exports = new FaceService();
