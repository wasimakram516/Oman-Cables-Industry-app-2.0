"use client";

import { useState } from "react";
import {
  Box,
  Button,
  TextField,
  LinearProgress,
  Typography,
  Snackbar,
  Alert,
  Stack,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import SaveIcon from "@mui/icons-material/Save";

export default function QRForm({ onClose, onCreated, initialData }) {
  const [file, setFile] = useState(null);
  const [x, setX] = useState(initialData?.x ?? 50);
  const [y, setY] = useState(initialData?.y ?? 50);
  const [width, setWidth] = useState(initialData?.width ?? 100);
  const [height, setHeight] = useState(initialData?.height ?? 10);
  const [progress, setProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "info",
  });

  const showSnackbar = (message, severity = "info") => {
    setSnackbar({ open: true, message, severity });
  };

  const getPresignedUrl = async (file) => {
    const res = await fetch("/api/qr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        presign: true,
        fileName: file.name,
        fileType: file.type,
      }),
    });
    if (!res.ok) throw new Error("Failed to get presigned URL");
    return await res.json();
  };

  const uploadToS3 = (file, uploadURL) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadURL, true);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setProgress(percent);
        }
      };
      xhr.onload = () =>
        xhr.status === 200 ? resolve() : reject(new Error("Upload failed"));
      xhr.onerror = () => reject(new Error("Upload error"));
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.send(file);
    });
  };

  const handleSubmit = async () => {
    if (!initialData && !file) {
      showSnackbar("Please upload a QR code", "error");
      return;
    }

    if (isNaN(x) || isNaN(y) || isNaN(width) || isNaN(height)) {
      showSnackbar("Position and size fields must be numbers", "error");
      return;
    }

    try {
      setSubmitting(true);
      setProgress(0);

      let payload = {
        x: Number(x),
        y: Number(y),
        width: Number(width),
        height: Number(height),
      };

      if (file) {
        const { uploadURL, key, fileUrl } = await getPresignedUrl(file);
        await uploadToS3(file, uploadURL);
        payload.s3Key = key;
        payload.s3Url = fileUrl;
      } else if (initialData) {
        payload.s3Key = initialData.s3Key;
        payload.s3Url = initialData.s3Url;
      }

      const method = initialData ? "PUT" : "POST";
      const res = await fetch("/api/qr", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Failed to save QR: ${res.status}`);

      showSnackbar("QR code saved successfully", "success");
      onCreated();
      onClose();
    } catch (err) {
      console.error("❌ Error in handleSubmit:", err);
      showSnackbar(err.message, "error");
    } finally {
      setSubmitting(false);
      setProgress(0);
    }
  };

  return (
    <>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
        <Button
          component="label"
          variant="outlined"
          startIcon={<UploadFileIcon />}
        >
          {initialData ? "Replace QR Code" : "Upload QR Code"}
          <input
            type="file"
            hidden
            accept="image/*,video/*"
            onChange={(e) => setFile(e.target.files[0])}
          />
        </Button>
        {file && <Typography>📎 {file.name}</Typography>}
        {initialData?.s3Key && !file && (
          <Typography color="textSecondary">
            Existing QR: {initialData.s3Key}
          </Typography>
        )}

        <Stack direction="row" spacing={2}>
          <TextField
            label="X (%)"
            type="number"
            value={x}
            onChange={(e) => setX(e.target.value)}
          />
          <TextField
            label="Y (%) from bottom"
            type="number"
            value={y}
            onChange={(e) => setY(e.target.value)}
          />
        </Stack>

        <Stack direction="row" spacing={2}>
          <TextField
            label="Width (%)"
            type="number"
            value={width}
            onChange={(e) => setWidth(e.target.value)}
          />
          <TextField
            label="Height (%)"
            type="number"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
          />
        </Stack>

        {submitting && (
          <Box sx={{ width: "100%", mt: 2 }}>
            <LinearProgress variant="determinate" value={progress} />
            <Typography variant="body2">{progress}%</Typography>
          </Box>
        )}

        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSubmit}
          disabled={submitting}
        >
          {initialData ? "Update QR Code" : "Save QR Code"}
        </Button>
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </>
  );
}