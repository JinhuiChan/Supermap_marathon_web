import { routeSelectionProfiles, type RouteSelectionProfile } from "../domain/routeMetrics";

interface SelectionProfilePanelProps {
  activeProfile: RouteSelectionProfile;
  onProfileChange: (profile: RouteSelectionProfile) => void;
  onApplyRecommendation: () => void;
}

export function SelectionProfilePanel({
  activeProfile,
  onProfileChange,
  onApplyRecommendation
}: SelectionProfilePanelProps) {
  return (
    <section className="side-section selection-profile-panel">
      <h2>智能选型目标</h2>
      <div className="selection-profile-options" role="group" aria-label="智能选型目标">
        {routeSelectionProfiles.map((profile) => (
          <button
            type="button"
            className={profile.id === activeProfile ? "active" : ""}
            aria-pressed={profile.id === activeProfile}
            key={profile.id}
            onClick={() => onProfileChange(profile.id)}
          >
            <strong>{profile.label}</strong>
            <span>{profile.description}</span>
          </button>
        ))}
      </div>
      <button type="button" className="apply-recommendation-button" onClick={onApplyRecommendation}>
        采用当前推荐
      </button>
    </section>
  );
}
