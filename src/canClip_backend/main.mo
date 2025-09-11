import Principal "mo:base/Principal";
import HashMap "mo:base/HashMap";
import Result "mo:base/Result";
import Time "mo:base/Time";
import Array "mo:base/Array";
import Buffer "mo:base/Buffer";
import Blob "mo:base/Blob";
import Text "mo:base/Text";
import Iter "mo:base/Iter";
import Int "mo:base/Int";

persistent actor {
  // User management
  private var userEntries : [(Principal, UserProfile)] = [];
  private transient var users = HashMap.HashMap<Principal, UserProfile>(1, Principal.equal, Principal.hash);
  
  // Media storage
  private var mediaEntries : [(Text, MediaItem)] = [];
  private transient var mediaStorage = HashMap.HashMap<Text, MediaItem>(1, Text.equal, Text.hash);
  
  // Media chunks storage
  private var chunkEntries : [(Text, MediaChunk)] = [];
  private transient var mediaChunks = HashMap.HashMap<Text, MediaChunk>(1, Text.equal, Text.hash);
  
  // User profile type
  public type UserProfile = {
    id: Principal;
    name: Text;
    email: ?Text;
    createdAt: Time.Time;
    lastLogin: Time.Time;
  };
  
  // Media item type
  public type MediaItem = {
    id: Text;
    userId: Principal;
    name: Text;
    mediaType: Text; // "video" or "audio"
    chunkCount: Nat;
    chunkSize: Nat;
    createdAt: Time.Time;
    totalSize: Nat;
  };
  
  // Media chunk type
  public type MediaChunk = {
    mediaId: Text;
    index: Nat;
    data: Blob;
  };
  
  // Auth result type
  public type AuthResult = Result.Result<{
    user: UserProfile;
    isNewUser: Bool;
  }, Text>;
  
  // Initialize stable storage
  system func preupgrade() {
    userEntries := Iter.toArray(users.entries());
    mediaEntries := Iter.toArray(mediaStorage.entries());
    chunkEntries := Iter.toArray(mediaChunks.entries());
  };

  system func postupgrade() {
    users := HashMap.fromIter<Principal, UserProfile>(
      userEntries.vals(), 1, Principal.equal, Principal.hash
    );
    mediaStorage := HashMap.fromIter<Text, MediaItem>(
      mediaEntries.vals(), 1, Text.equal, Text.hash
    );
    mediaChunks := HashMap.fromIter<Text, MediaChunk>(
      chunkEntries.vals(), 1, Text.equal, Text.hash
    );
    userEntries := [];
    mediaEntries := [];
    chunkEntries := [];
  };
  // Authentication functions
  public shared(msg) func authenticate() : async AuthResult {
    let caller = msg.caller;
    let now = Time.now();
    
    switch (users.get(caller)) {
      case (?existingUser) {
        // Update last login
        let updatedUser = {
          id = existingUser.id;
          name = existingUser.name;
          email = existingUser.email;
          createdAt = existingUser.createdAt;
          lastLogin = now;
        };
        users.put(caller, updatedUser);
        #ok({ user = updatedUser; isNewUser = false })
      };
      case null {
        // Create new user
        let principalTxt = Principal.toText(caller);
        let prefixChars = Array.take(Text.toArray(principalTxt), 8);

        let newUser = {
          id = caller;
          name = "User_" # Text.fromIter(prefixChars.vals());
          email = null;
          createdAt = now;
          lastLogin = now;
        };
        users.put(caller, newUser);
        #ok({ user = newUser; isNewUser = true })
      };
    }
  };
  
  // User profile management
  public shared(msg) func updateProfile(name: Text, email: ?Text) : async Result.Result<Text, Text> {
    let caller = msg.caller;
    
    switch (users.get(caller)) {
      case (?user) {
        let updatedUser = {
          id = user.id;
          name = name;
          email = email;
          createdAt = user.createdAt;
          lastLogin = user.lastLogin;
        };
        users.put(caller, updatedUser);
        #ok("Profile updated successfully")
      };
      case null {
        #err("User not found")
      };
    }
  };
  
  public query func getProfile() : async ?UserProfile {
    // Note: This should be called with the authenticated user's principal
    // In a real app, you'd get this from the calling context
    null
  };
  
  // Constants
  private let MAX_CHUNK_SIZE = 1_000_000; // 1MB max chunk size
  
  // Media storage functions
  public shared(msg) func uploadMediaInit(name: Text, mediaType: Text, chunkCount: Nat, chunkSize: Nat, totalSize: Nat) : async Result.Result<Text, Text> {
    let caller = msg.caller;
    let mediaId = "media_" # Principal.toText(caller) # "_" # Int.toText(Time.now());
    
    // Validate chunk size
    if (chunkSize > MAX_CHUNK_SIZE) {
      return #err("Chunk size exceeds maximum allowed size of " # Int.toText(MAX_CHUNK_SIZE) # " bytes");
    };
    
    let mediaItem = {
      id = mediaId;
      userId = caller;
      name = name;
      mediaType = mediaType;
      chunkCount = chunkCount;
      chunkSize = chunkSize;
      createdAt = Time.now();
      totalSize = totalSize;
    };
    
    mediaStorage.put(mediaId, mediaItem);
    #ok(mediaId)
  };
  
  public shared(msg) func uploadMediaChunk(mediaId: Text, index: Nat, chunk: Blob) : async Result.Result<Text, Text> {
    let caller = msg.caller;
    
    // Validate chunk size
    if (chunk.size() > MAX_CHUNK_SIZE) {
      return #err("Chunk size exceeds maximum allowed size of " # Int.toText(MAX_CHUNK_SIZE) # " bytes");
    };
    
    // Check if media exists and belongs to caller
    switch (mediaStorage.get(mediaId)) {
      case (?media) {
        if (media.userId != caller) {
          return #err("Unauthorized to upload chunks for this media");
        };
        
        // Validate index
        if (index >= media.chunkCount) {
          return #err("Chunk index out of range");
        };
        
        let chunkKey = mediaId # "_" # Int.toText(index);
        let mediaChunk = {
          mediaId = mediaId;
          index = index;
          data = chunk;
        };
        
        mediaChunks.put(chunkKey, mediaChunk);
        #ok("Chunk uploaded successfully")
      };
      case null {
        #err("Media not found")
      };
    }
  };
  
  public query func getMedia(mediaId: Text) : async ?MediaItem {
    mediaStorage.get(mediaId)
  };
  
  public query func getMediaChunk(mediaId: Text, index: Nat) : async ?Blob {
    let chunkKey = mediaId # "_" # Int.toText(index);
    switch (mediaChunks.get(chunkKey)) {
      case (?chunk) ?chunk.data;
      case null null;
    }
  };
  
  public shared(msg) func getUserMedia() : async [MediaItem] {
    let caller = msg.caller;
    let userMedia = Buffer.Buffer<MediaItem>(0);
    
    for ((id, media) in mediaStorage.entries()) {
      if (media.userId == caller) {
        userMedia.add(media);
      };
    };
    
    Buffer.toArray(userMedia)
  };
  
  public shared(msg) func deleteMedia(mediaId: Text) : async Result.Result<Text, Text> {
    let caller = msg.caller;
    
    switch (mediaStorage.get(mediaId)) {
      case (?media) {
        if (media.userId == caller) {
          // Delete all chunks for this media
          for (i in Iter.range(0, media.chunkCount - 1)) {
            let chunkKey = mediaId # "_" # Int.toText(i);
            mediaChunks.delete(chunkKey);
          };
          
          mediaStorage.delete(mediaId);
          #ok("Media deleted successfully")
        } else {
          #err("Unauthorized to delete this media")
        }
      };
      case null {
        #err("Media not found")
      };
    }
  };
  
  // Utility functions
  public query func getStorageStats() : async { userCount: Nat; mediaCount: Nat; totalSize: Nat; chunkCount: Nat } {
    var totalSize = 0;
    for ((id, media) in mediaStorage.entries()) {
      totalSize += media.totalSize;
    };
    
    {
      userCount = users.size();
      mediaCount = mediaStorage.size();
      totalSize = totalSize;
      chunkCount = mediaChunks.size();
    }
  };
};
