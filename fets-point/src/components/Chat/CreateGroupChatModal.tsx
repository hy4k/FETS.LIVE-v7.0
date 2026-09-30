import React, { useState } from 'react';
import { useAllStaff } from '../../hooks/useFetsConnect';
import { useCreateGroupConversation } from '../../hooks/useChat';
import { useAuth } from '../../hooks/useAuth';

const CreateGroupChatModal = ({ setIsModalOpen }) => {
  const { user, profile } = useAuth();
  const { data: users = [], isLoading } = useAllStaff();
  const createGroupConversation = useCreateGroupConversation();
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const handleCreateGroup = async () => {
    if (groupName.trim() && selectedMembers.length > 0) {
      try { await createGroupConversation.mutateAsync({ name: groupName, memberIds: selectedMembers, createdBy: profile?.id || user.id });setIsModalOpen(false); } catch { /* Mutation displays the error and keeps selections. */ }
    }
  };

  const handleMemberSelection = (memberId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  if (isLoading) {
    return <div>Loading users...</div>;
  }

  return (
    <div className="fixed inset-0 z-[9000] bg-black bg-opacity-50 flex items-center justify-center">
      <div role="dialog" aria-modal="true" aria-label="Create group chat" className="bg-white text-slate-800 rounded-lg p-6 w-[min(500px,94vw)]">
        <h2 className="text-lg font-bold mb-4">Create Group Chat</h2>
        <input
          type="text"
          placeholder="Group Name"
          className="w-full p-2 border rounded-md mb-4"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
        />
        <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
          {users
            .filter((u) => u.id !== profile?.id && u.user_id !== user?.id)
            .map((user) => (
              <div
                key={user.id}
                className={`flex items-center gap-4 p-2 rounded-lg cursor-pointer ${
                  selectedMembers.includes(user.id) ? 'bg-blue-200' : 'hover:bg-gray-200'
                }`}
                onClick={() => handleMemberSelection(user.id)}
              >
                <img
                  src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.full_name}&background=random`}
                  alt={user.full_name}
                  className="w-10 h-10 rounded-full"
                />
                <p className="font-semibold">{user.full_name}</p>
              </div>
            ))}
        </div>
        <div className="flex justify-end gap-4 mt-4">
          <button className="p-2 bg-gray-300 rounded-md" onClick={() => setIsModalOpen(false)}>
            Cancel
          </button>
          <button disabled={createGroupConversation.isPending || !groupName.trim() || !selectedMembers.length} className="p-2 bg-blue-500 text-white rounded-md" onClick={handleCreateGroup}>
            Create
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateGroupChatModal;
