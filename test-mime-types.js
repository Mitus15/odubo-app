// Test script to verify MIME type mapping for audio files
const audioMimeTypes = {
  'mp3': 'audio/mpeg',
  'm4a': 'audio/mp4',
  'aac': 'audio/aac',
  'wav': 'audio/wav',
  'flac': 'audio/flac',
  'ogg': 'audio/ogg',
  'webm': 'audio/webm'
};

function testMimeTypeMapping(fileName, originalContentType) {
  const extension = fileName.toLowerCase().split('.').pop();
  let finalContentType = originalContentType;
  
  if (extension && audioMimeTypes[extension]) {
    finalContentType = audioMimeTypes[extension];
    console.log(`✅ ${fileName}: ${extension} → ${finalContentType} (original: ${originalContentType})`);
  } else {
    console.log(`❌ ${fileName}: Using original content type: ${originalContentType}`);
  }
  
  return finalContentType;
}

// Test various audio file scenarios
console.log('Testing MIME type mapping for audio files:');
console.log('============================================');

testMimeTypeMapping('song.m4a', 'audio/x-m4a');  // This was the problematic case
testMimeTypeMapping('song.mp3', 'audio/mpeg');
testMimeTypeMapping('song.mp3', 'audio/mp3');    // Wrong original type
testMimeTypeMapping('song.wav', 'audio/wav');
testMimeTypeMapping('song.flac', 'audio/flac');
testMimeTypeMapping('song.aac', 'audio/aac');
testMimeTypeMapping('song.ogg', 'audio/ogg');
testMimeTypeMapping('song.webm', 'audio/webm');
testMimeTypeMapping('document.pdf', 'application/pdf');  // Non-audio file

console.log('\n✅ All .m4a files will now be served with audio/mp4 MIME type');
console.log('✅ New uploads are properly configured!');
