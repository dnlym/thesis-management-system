import multer from 'multer';
import path from 'path';
import { FILE_UPLOAD } from '../constants';

const storage = multer.memoryStorage();

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Get submission type from request body
  const submissionType = req.body.type as keyof typeof FILE_UPLOAD.ALLOWED_TYPES;
  
  if (!submissionType) {
    return cb(new Error('Submission type is required'));
  }

  const allowedTypes = FILE_UPLOAD.ALLOWED_TYPES[submissionType];
  
  if (!allowedTypes) {
    return cb(new Error('Invalid submission type'));
  }

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`));
  }
};

export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: Math.max(...Object.values(FILE_UPLOAD.MAX_SIZE)),
  },
});

/**
 * Dedicated multer instance for Extra Point Evidence uploads.
 * This avoids the issue where fileFilter reads req.body.type
 * but Multer hasn't parsed it yet (file field comes before type in FormData).
 */
const extraPointFileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = FILE_UPLOAD.ALLOWED_TYPES.EXTRA_POINT_EVIDENCE;
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed. Allowed: ${allowedTypes.join(', ')}`));
  }
};

export const uploadExtraPointEvidence = multer({
  storage: storage,
  fileFilter: extraPointFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});
