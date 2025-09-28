import AWS from 'aws-sdk';
import fs from 'fs';

class S3Service {
  constructor() {
    // Don't set bucketName in constructor - it will be undefined
    // Instead, get it dynamically when needed
  }

  // Configure AWS (call this before using the service)
  configure() {
    AWS.config.update({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION
    });
    this.s3 = new AWS.S3();
    this.bucketName = process.env.AWS_BUCKET_NAME;
    
    console.log('S3 Service configured with bucket:', this.bucketName);
  }

  // Upload a single file
  async uploadFile(filePath, key, contentType = 'image/jpeg') {
    if (!this.s3) {
      throw new Error('S3Service not configured. Call configure() first.');
    }
    
    try {
      const fileContent = fs.readFileSync(filePath);
      
      const params = {
        Bucket: this.bucketName,
        Key: key,
        Body: fileContent,
        ContentType: contentType
        // Removed ACL parameter - public access is handled by bucket policy
      };

      const result = await this.s3.upload(params).promise();
      console.log(`Uploaded: ${result.Location}`);
      return result.Location;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  // Get file URL
  getFileUrl(key) {
    return `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  }
}

export default new S3Service();