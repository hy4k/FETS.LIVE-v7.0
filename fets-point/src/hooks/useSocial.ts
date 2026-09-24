import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';

// Types
export interface SocialPost {
  id: string;
  user_id: string;
  content: string;
  image_url?: string;
  created_at: string;
  user?: {
    id: string;
    full_name: string;
    avatar_url?: string;
    role?: string;
  };
  likes?: Array<{ user_id: string }>;
  comments?: Array<{
    id: string;
    user_id: string;
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
          user:staff_profiles!social_posts_author_id_fkey(id, full_name, avatar_url, role),
          likes:social_post_likes(user_id),
          comments:social_post_comments(
            id,
            author_id,
            content,
            created_at,
            user:staff_profiles!social_post_comments_author_id_fkey(full_name, avatar_url)
          )
        `)
        .or('is_archived.is.null,is_archived.eq.false')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Add count
      return ((data as any[]) || []).map((post: any) => ({
        ...post,
        _count: {
          likes: post.likes?.length || 0,
          comments: post.comments?.length || 0
        }
      }));
    },
    refetchInterval: 5000, // Refresh every 5 seconds
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
    mutationFn: async ({ content, image_url, user_id, post_type, branch_location }: { content: string; image_url?: string; user_id: string; post_type?: string; branch_location?: string }) => {
      // Insert without returning to avoid RLS issues
      const { error } = await supabase
        .from('social_posts' as any)
        .insert([{
          content,
          image_url,
          user_id,
          post_type,
          branch_location
        }]);

      if (error) throw error;

      // Fetch the post after insertion
      await new Promise(resolve => setTimeout(resolve, 100));
      return { content, image_url, user_id, post_type, branch_location };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
      toast.success('Post created! 🎉');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create post');
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
    mutationFn: async ({ post_id, user_id, content }: { post_id: string; user_id: string; content: string }) => {
      // Use RPC to bypass RLS issues
      const { error } = await supabase.rpc('add_comment', {
        post_id: post_id,
        content: content
      });

      // Fallback to direct insert if RPC doesn't exist
      if (error && error.message?.includes('function')) {
        const { error: insertError } = await supabase
          .from('social_comments' as any)
          .insert([{ post_id, user_id, content }]);
        if (insertError) throw insertError;
      } else if (error) {
        throw error;
      }

      return { post_id, user_id, content };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
      toast.success('Comment added!');
    },
    onError: (error: any) => {
      console.error('Comment error:', error);
      toast.error('Failed to add comment. Please refresh the page.');
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
