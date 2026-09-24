import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';

// Types
export interface SocialPost {
  id: string;
  user_id?: string;
  author_id?: string;
  content: string;
  image_url?: string;
  video_url?: string;
  post_type?: string;
  branch_location?: string;
  pinned?: boolean;
  visibility?: string;
  created_at: string;
  updated_at?: string;
  user?: {
    id?: string;
    full_name: string;
    avatar_url?: string;
    role?: string;
    branch_assigned?: string;
  };
  likes?: Array<{ user_id: string }>;
  comments?: Array<{
    id: string;
    user_id?: string;
    author_id?: string;
    content: string;
    created_at: string;
    user?: {
      full_name: string;
      avatar_url?: string;
    };
  }>;
  _count?: {
    likes: number;
    comments: number;
  };
}

// Fetch all posts with user info, likes, and comments
export const useSocialPosts = () => {
  return useQuery({
    queryKey: ['social-posts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('social_posts' as any)
        .select(`
          *,
          user:staff_profiles!social_posts_author_id_fkey(id, full_name, avatar_url, role, branch_assigned),
          likes:social_post_likes(user_id),
          comments:social_post_comments(
            id,
            author_id,
            user_id,
            content,
            created_at,
            user:staff_profiles!social_post_comments_author_id_fkey(full_name, avatar_url)
          )
        `)
        .or('is_archived.is.null,is_archived.eq.false')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const rawPosts = (data as any[]) || [];

      // Check if any post is missing user object (e.g. author_id was null or mismatched)
      const missingUserIds = rawPosts
        .filter(p => !p.user && p.user_id)
        .map(p => p.user_id);

      let profileMap: Record<string, any> = {};
      if (missingUserIds.length > 0) {
        const uniqueIds = Array.from(new Set(missingUserIds));
        const { data: fallbackProfiles } = await supabase
          .from('staff_profiles')
          .select('id, user_id, full_name, avatar_url, role, branch_assigned')
          .or(`id.in.(${uniqueIds.map(id => `"${id}"`).join(',')}),user_id.in.(${uniqueIds.map(id => `"${id}"`).join(',')})`);
        
        (fallbackProfiles || []).forEach(prof => {
          profileMap[prof.id] = prof;
          if (prof.user_id) profileMap[prof.user_id] = prof;
        });
      }

      // Add count & resolve author fallback
      return rawPosts.map((post: any) => {
        let author = post.user;
        if (!author && post.user_id && profileMap[post.user_id]) {
          author = profileMap[post.user_id];
        }
        if (!author && post.author_id && profileMap[post.author_id]) {
          author = profileMap[post.author_id];
        }
        if (!author) {
          author = {
            full_name: 'Exam Center Staff',
            role: 'Staff Member'
          };
        }

        return {
          ...post,
          user: author,
          _count: {
            likes: post.likes?.length || 0,
            comments: post.comments?.length || 0
          }
        };
      });
    },
    refetchInterval: 4000, // Refresh every 4 seconds
  });
};

// Get current user's profile
export const useCurrentUser = () => {
  return useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('staff_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });
};

// Create a new post
export const useCreatePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      content,
      image_url,
      video_url,
      user_id,
      author_id,
      post_type,
      branch_location,
      pinned,
      visibility
    }: {
      content: string;
      image_url?: string;
      video_url?: string;
      user_id?: string;
      author_id?: string;
      post_type?: string;
      branch_location?: string;
      pinned?: boolean;
      visibility?: string;
    }) => {
      // Look up staff profile if author_id is missing
      let resolvedAuthorId = author_id;
      if (!resolvedAuthorId && user_id) {
        const { data: prof } = await supabase
          .from('staff_profiles')
          .select('id')
          .or(`id.eq.${user_id},user_id.eq.${user_id}`)
          .maybeSingle();
        if (prof) resolvedAuthorId = prof.id;
      }

      const insertPayload: any = {
        content,
        image_url: image_url || null,
        user_id: user_id || resolvedAuthorId,
        author_id: resolvedAuthorId || user_id,
        post_type: post_type || 'General',
        branch_location: branch_location || 'global',
        pinned: !!pinned,
        visibility: visibility || 'branch'
      };

      const { data, error } = await supabase
        .from('social_posts' as any)
        .insert([insertPayload])
        .select();

      if (error) {
        console.error('Insert error in useCreatePost:', error);
        // Fallback without author_id if constraint fails
        delete insertPayload.author_id;
        const { error: fallbackError } = await supabase
          .from('social_posts' as any)
          .insert([insertPayload]);
        if (fallbackError) throw fallbackError;
      }

      await new Promise(resolve => setTimeout(resolve, 150));
      return insertPayload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
      toast.success('Notice published to Live! 📢');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to post update');
    },
  });
};

// Toggle like on a post
export const useToggleLike = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ post_id, user_id, isLiked }: { post_id: string; user_id: string; isLiked: boolean }) => {
      if (isLiked) {
        // Unlike - use RPC to bypass RLS
        const { error } = await supabase.rpc('unlike_post', {
          post_id: post_id
        });

        // Fallback to direct delete if RPC doesn't exist
        if (error && error.message?.includes('function')) {
          const { error: deleteError } = await supabase
            .from('social_likes' as any)
            .delete()
            .eq('post_id', post_id)
            .eq('user_id', user_id);
          if (deleteError) throw deleteError;
        } else if (error) {
          throw error;
        }
      } else {
        // Like - use RPC to bypass RLS
        const { error } = await supabase.rpc('like_post', {
          post_id: post_id
        });

        // Fallback to direct insert if RPC doesn't exist
        if (error && error.message?.includes('function')) {
          const { error: insertError } = await supabase
            .from('social_likes' as any)
            .insert([{ post_id, user_id }]);
          if (insertError) throw insertError;
        } else if (error) {
          throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
    },
    onError: (error: any) => {
      console.error('Like error:', error);
      toast.error('Failed to update like. Please refresh the page.');
    },
  });
};

// Add a comment
export const useAddComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ post_id, user_id, author_id, content }: { post_id: string; user_id?: string; author_id?: string; content: string }) => {
      // Look up author profile if needed
      let resolvedAuthorId = author_id;
      if (!resolvedAuthorId && user_id) {
        const { data: prof } = await supabase
          .from('staff_profiles')
          .select('id')
          .or(`id.eq.${user_id},user_id.eq.${user_id}`)
          .maybeSingle();
        if (prof) resolvedAuthorId = prof.id;
      }

      const commentPayload: any = {
        post_id,
        user_id: user_id || resolvedAuthorId,
        author_id: resolvedAuthorId || user_id,
        content
      };

      // Try inserting into social_post_comments
      const { error: insertError } = await supabase
        .from('social_post_comments' as any)
        .insert([commentPayload]);

      if (insertError) {
        console.warn('Direct insert into social_post_comments error, trying RPC:', insertError);
        const { error: rpcError } = await supabase.rpc('add_comment', {
          post_id: post_id,
          content: content
        });
        if (rpcError) {
          const { error: fb2 } = await supabase
            .from('social_post_comments' as any)
            .insert([{ post_id, content, user_id }]);
          if (fb2) throw insertError;
        }
      }

      return { post_id, user_id: commentPayload.user_id, content };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
      toast.success('Response posted! 💬');
    },
    onError: (error: any) => {
      console.error('Comment error:', error);
      toast.error('Failed to add response. Please try again.');
    },
  });
};

// Update a post (edit)
export const useUpdatePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ post_id, content, image_url }: { post_id: string; content: string; image_url?: string }) => {
      const { error } = await supabase
        .from('social_posts' as any)
        .update({ content, image_url, updated_at: new Date().toISOString() })
        .eq('id', post_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
      toast.success('Post updated! ✏️');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update post');
    },
  });
};

// Delete a post (soft-delete by archiving)
export const useDeletePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (post_id: string) => {
      // Soft delete by setting is_archived to true
      const { error } = await supabase
        .from('social_posts' as any)
        .update({ is_archived: true, archived_at: new Date().toISOString() })
        .eq('id', post_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
      toast.success('Post archived 🗂️');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to archive post');
    },
  });
};

// Upload image to Supabase Storage
export const useUploadImage = () => {
  return useMutation({
    mutationFn: async (file: File) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `posts/${fileName}`;

      console.log('🖼️ Uploading image:', fileName);

      // Primary bucket to use
      const primaryBucket = 'post-images';

      // Try primary bucket first
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(primaryBucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('❌ Upload failed:', uploadError);

        // Try fallback buckets
        const fallbackBuckets = ['attachments', 'public', 'avatars', 'images'];

        for (const bucketName of fallbackBuckets) {
          console.log(`🔄 Trying fallback bucket: ${bucketName}`);
          const { error: fallbackError } = await supabase.storage
            .from(bucketName)
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: true
            });

          if (!fallbackError) {
            console.log(`✅ Upload successful to: ${bucketName}`);
            const { data } = supabase.storage
              .from(bucketName)
              .getPublicUrl(filePath);

            toast.success('Image uploaded! 📸');
            return data.publicUrl;
          }
        }

        // All buckets failed
        console.error('❌ All storage buckets failed');
        toast.error('Image upload failed. Creating bucket... Please run CREATE-STORAGE-BUCKET.bat');
        throw new Error('No storage bucket available. Please create "post-images" bucket in Supabase Storage.');
      }

      // Success with primary bucket
      console.log('✅ Upload successful!');
      const { data } = supabase.storage
        .from(primaryBucket)
        .getPublicUrl(filePath);

      toast.success('Image uploaded! 📸');
      return data.publicUrl;
    },
    onError: (error: any) => {
      console.error('Upload error:', error);
      toast.error('Failed to upload image. Please try again.');
    },
  });
};
