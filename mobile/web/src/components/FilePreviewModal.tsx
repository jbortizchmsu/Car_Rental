import React, { useEffect, useState } from 'react';
import { X, Loader2, Download, AlertCircle, Maximize2, Minimize2, FileText } from 'lucide-react';

interface FilePreviewModalProps {
  fileId: string;
  title: string;
  onClose: () => void;
  fetchFileBlob: (id: string) => Promise<any>;
}

const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ fileId, title, onClose, fetchFileBlob }) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [contentType, setContentType] = useState<string>('');

  useEffect(() => {
    let url: string | null = null;

    const loadFile = async () => {
      try {
        setLoading(true);
        const response = await fetchFileBlob(fileId);
        
        // Response should be a blob if responseType: 'blob' was used in Axios
        const blob = response.data;
        setContentType(blob.type);
        
        url = URL.createObjectURL(blob);
        setBlobUrl(url);
      } catch (err: any) {
        console.error('Failed to load file blob:', err);
        setError('Unable to load the secure file. The link may have expired or you may not have permission.');
      } finally {
        setLoading(false);
      }
    };

    loadFile();

    return () => {
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [fileId, fetchFileBlob]);

  const handleDownload = () => {
    if (!blobUrl) return;
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `${title.replace(/\s+/g, '_')}_${fileId.substring(0, 8)}.${contentType.split('/')[1] || 'bin'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isImage = contentType.startsWith('image/');
  const isPdf = contentType === 'application/pdf';

  return (
    <div className="modal-overlay" style={{ zIndex: 2000 }} onClick={onClose}>
      <div 
        className="modal-container" 
        style={{ 
          maxWidth: isFullscreen ? '95vw' : '800px', 
          width: '100%',
          maxHeight: isFullscreen ? '95vh' : '90vh',
          height: isFullscreen ? '95vh' : 'auto',
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.3s ease'
        }} 
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <h2 className="modal-title">{title}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {blobUrl && (
              <button 
                onClick={handleDownload}
                className="btn-outline"
                style={{ padding: '0.4rem', border: 'none' }}
                title="Download"
              >
                <Download size={20} />
              </button>
            )}
            <button 
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="btn-outline"
              style={{ padding: '0.4rem', border: 'none' }}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>
            <button 
              onClick={onClose} 
              style={{ background: 'none', padding: '0.4rem', border: 'none', cursor: 'pointer' }}
              title="Close"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="modal-content" style={{ 
          flex: 1, 
          overflow: 'hidden', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          backgroundColor: '#f5f5f5',
          padding: '1rem',
          minHeight: '400px'
        }}>
          {loading ? (
            <div style={{ textAlign: 'center' }}>
              <Loader2 className="animate-spin" size={48} color="var(--warm-taupe)" />
              <p style={{ marginTop: '1rem', color: 'var(--muted-mauve)' }}>Fetching secure file...</p>
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', maxWidth: '400px' }}>
              <AlertCircle size={48} color="#C62828" style={{ margin: '0 auto 1.5rem' }} />
              <h3 style={{ marginBottom: '1rem' }}>Preview Failed</h3>
              <p style={{ color: 'var(--muted-mauve)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>{error}</p>
              <button onClick={onClose} className="btn-primary">Close</button>
            </div>
          ) : blobUrl ? (
            <>
              {isImage ? (
                <img 
                  src={blobUrl} 
                  alt={title} 
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: '100%', 
                    objectFit: 'contain',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }} 
                />
              ) : isPdf ? (
                <iframe 
                  src={blobUrl} 
                  title={title} 
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <FileText size={64} color="var(--muted-mauve)" style={{ marginBottom: '1rem' }} />
                  <p>This file type ({contentType}) cannot be previewed directly.</p>
                  <button onClick={handleDownload} className="btn-primary" style={{ marginTop: '1rem' }}>
                    Download to View
                  </button>
                </div>
              )}
            </>
          ) : null}
        </div>
        
        <div className="modal-footer" style={{ flexShrink: 0, justifyContent: 'center' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--muted-mauve)' }}>
            This is a secure document. It is only visible to authorized personnel.
          </p>
        </div>
      </div>
    </div>
  );
};

export default FilePreviewModal;
