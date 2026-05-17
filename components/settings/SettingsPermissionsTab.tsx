import React, { useState, useEffect } from 'react';
import { Shield, Lock } from 'lucide-react';
import { supabase } from '../../services/supabase';

interface Permission {
  id: string;
  slug: string;
  label: string;
  description: string;
}

interface Role {
  id: string;
  name: string;
  label: string;
  color: string;
  is_admin: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  'violation': 'Vi phạm/Thành tích',
  'settings': 'Cài đặt',
  'users': 'Tài khoản',
  'roles': 'Vai trò',
  'reports': 'Báo cáo',
  'ranking': 'Xếp hạng',
  'audit': 'Audit Log',
  'image': 'Ảnh',
  'zalo': 'Zalo Bot',
};

const SettingsPermissionsTab: React.FC = () => {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [permRes, roleRes] = await Promise.all([
      supabase.from('permissions').select('*').order('slug'),
      supabase.from('roles').select('*').order('name'),
    ]);
    setPermissions(permRes.data || []);
    setRoles(roleRes.data || []);
    setLoading(false);
  };

  // Group permissions by category prefix
  const groupedPermissions = permissions.reduce<Record<string, Permission[]>>((acc, perm) => {
    const category = perm.slug.split('.')[0] || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(perm);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <h3 className="font-bold text-lg mb-4 text-slate-800 flex items-center gap-2">
        <Lock size={20} /> Danh sách Quyền hạn
      </h3>

      <div className="space-y-6">
        {Object.entries(groupedPermissions).map(([category, perms]) => (
          <div key={category}>
            <h4 className="text-sm font-bold text-slate-600 uppercase mb-2 flex items-center gap-2">
              {CATEGORY_LABELS[category] || category}
              <span className="text-xs font-normal text-slate-400">({category}.*)</span>
            </h4>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left font-bold">Mã quyền</th>
                    <th className="px-3 py-2 text-left font-bold">Tên</th>
                    <th className="px-3 py-2 text-left font-bold hidden md:table-cell">Mô tả</th>
                    <th className="px-3 py-2 text-center font-bold">Vai trò có quyền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {perms.map(perm => (
                    <tr key={perm.id} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2">
                        <code className="text-xs bg-slate-100 px-2 py-0.5 rounded font-mono text-slate-600">
                          {perm.slug}
                        </code>
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-700">{perm.label}</td>
                      <td className="px-3 py-2 text-slate-500 text-xs hidden md:table-cell">
                        {perm.description || '-'}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {roles.map(role => {
                            // Role permission mapping handled by backend RLS
                            // For display, show is_admin roles have all permissions conceptually
                            const hasPerm = role.is_admin || false;
                            return (
                              <span
                                key={role.id}
                                className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                  hasPerm
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-slate-100 text-slate-400'
                                }`}
                              >
                                {role.label}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SettingsPermissionsTab;